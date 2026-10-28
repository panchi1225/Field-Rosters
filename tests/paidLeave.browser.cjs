const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const { createServer } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  const server = await createServer({
    configFile: false,
    root: path.resolve(__dirname, '..'),
    base: '/Field-Rosters/',
    plugins: [react()],
    resolve: { alias: {
      'firebase/app': path.join(__dirname, 'mocks/firebase-app.ts'),
      'firebase/firestore': path.join(__dirname, 'mocks/firebase-firestore.ts'),
    } },
    server: { host: '127.0.0.1', port: 4173, strictPort: true },
    logLevel: 'error',
  });
  await server.listen();
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Los_Angeles' });
  const errors = [];
  const people = [
    { id: 'p1', name: '佐藤', role: 'STAFF', siteId: 'a', hasLunch: true, vehicleId: null },
    { id: 'p2', name: '鈴木', role: 'WORKER', siteId: 'yasumi', hasLunch: true, vehicleId: null },
    { id: 'p3', name: '高橋', role: 'MANAGER', siteId: 'b', hasLunch: true, vehicleId: null },
  ];
  const board = {
    people: JSON.stringify(people),
    sites: JSON.stringify([{ id: 'a', name: '第一現場', order: 0 }, { id: 'b', name: '第二現場', order: 1 }]),
    vehicles: '[]',
    lastUpdateInfo: JSON.stringify({ time: '2026-10-27T03:00:00.000Z', name: '高橋' }),
    updatedAt: '2026-10-27T03:00:00.000Z',
  };
  await context.addInitScript(({ board }) => {
    if (localStorage.getItem('fixture_seeded')) return;
    localStorage.setItem('fixture_seeded', 'true');
    localStorage.setItem('fixture_doc_app_data/shared_board', JSON.stringify(board));
    localStorage.setItem('fixture_doc_app_data/shared_paid_leaves', JSON.stringify({ entries: {
      'p2_2026-10-29': { personId: 'p2', date: '2026-10-29' },
    } }));
    for (const [key, value] of Object.entries({ wb_people: board.people, wb_sites: board.sites, wb_vehicles: board.vehicles, wb_last_update: board.lastUpdateInfo })) localStorage.setItem(key, value);
  }, { board });
  await context.route(/firestore\.googleapis\.com/, route => { errors.push('Unexpected real Firebase request'); return route.abort(); });
  const notifications = [];
  let rejectNotification = false;
  await context.route('https://lineworks-proxy.paaaaanchi1225.workers.dev/**', route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    notifications.push(route.request().postDataJSON());
    return route.fulfill({ status: rejectNotification ? 500 : 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: '{}' });
  });

  const page = await context.newPage();
  const other = await context.newPage();
  for (const target of [page, other]) {
    target.on('pageerror', error => errors.push(error.message));
    await target.clock.setFixedTime(new Date('2026-10-28T03:00:00.000Z'));
    await target.goto('http://127.0.0.1:4173/Field-Rosters/');
    await target.getByRole('button', { name: '有給休暇', exact: true }).click();
    await target.getByRole('button', { name: /2026年10月29日/ }).click();
  }
  const waitCount = (target, count) => target.getByText(`有給休暇者 ${count}名`, { exact: true }).waitFor();
  const register = async (target, id) => {
    await target.getByLabel('有給休暇を取る人員').selectOption(id);
    await target.getByRole('button', { name: '有給休暇を登録', exact: true }).click();
    await target.getByText('有給休暇を登録しました。', { exact: true }).waitFor();
  };
  try {
    await waitCount(page, 1);
    await register(page, 'p1');
    await waitCount(other, 2);
    await waitCount(page, 2);
    assert.equal(await page.locator('option[value="p1"]').evaluate(option => option.disabled), true);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('fixture_doc_app_data/shared_board'))), board);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '佐藤の有給を取り消す' }).click();
    await waitCount(other, 1);
    console.log('PASS: unprotected registration, duplicate prevention, cross-tab sync, cancellation, roster timestamp unchanged');

    await page.evaluate(() => localStorage.setItem('fixture_reject_write', 'true'));
    await page.getByLabel('有給休暇を取る人員').selectOption('p3');
    await page.getByRole('button', { name: '有給休暇を登録', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '保存できませんでした' }).waitFor();
    await waitCount(page, 1);
    assert.equal(await page.getByText('有給休暇を登録しました。', { exact: true }).count(), 0);
    await page.evaluate(() => localStorage.removeItem('fixture_reject_write'));
    console.log('PASS: rejected writes display failure without claiming success');

    await other.getByLabel('有給休暇を取る人員').selectOption('p1');
    await page.evaluate(() => localStorage.setItem('fixture_offline', 'true'));
    await other.getByText('有給休暇の最新情報を確認中です。', { exact: false }).waitFor();
    assert.equal(await other.getByRole('button', { name: '有給休暇を登録', exact: true }).isDisabled(), true);
    await page.evaluate(() => localStorage.removeItem('fixture_offline'));
    await other.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
    console.log('PASS: cached data is labelled and writes are disabled until server information returns');

    await other.getByRole('button', { name: '有給休暇を閉じる' }).click();
    await other.getByRole('heading', { name: '休み（1名）', exact: true }).waitFor();
    assert.equal(await other.getByRole('button', { name: '管理者認証', exact: true }).isVisible(), true);
    assert.equal(await other.getByRole('button', { name: 'LINE通知', exact: true }).isVisible(), true);
    assert.equal(await other.evaluate(() => JSON.parse(localStorage.getItem('fixture_writes')).filter(write => write.path === 'app_data/shared_board').length), 0);
    await other.getByRole('button', { name: 'LINE通知', exact: true }).click();
    const notificationDialog = other.getByRole('dialog', { name: '📣 LINE WORKS 通知' });
    await notificationDialog.getByLabel('通知配信パスワード').fill('wrong');
    await notificationDialog.getByRole('button', { name: '送信', exact: true }).click();
    await notificationDialog.getByRole('alert').filter({ hasText: 'パスワードが違います' }).waitFor();
    assert.equal(notifications.length, 0);
    await notificationDialog.getByLabel('通知配信パスワード').fill('4043');
    await notificationDialog.getByRole('button', { name: '送信', exact: true }).click();
    await notificationDialog.getByText('通知を送信しました', { exact: true }).waitFor();
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].title, '現場配置表通知');
    assert.equal(notifications[0].button.url, 'https://panchi1225.github.io/Field-Rosters/');
    assert.equal(notifications[0].text.includes('更新者：高橋'), true);
    await notificationDialog.waitFor({ state: 'hidden' });
    rejectNotification = true;
    await other.getByRole('button', { name: 'LINE通知', exact: true }).click();
    await notificationDialog.getByLabel('通知配信パスワード').fill('4043');
    await notificationDialog.getByRole('button', { name: '送信', exact: true }).click();
    await notificationDialog.getByRole('alert').filter({ hasText: '通知の送信に失敗しました' }).waitFor();
    await notificationDialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
    console.log('PASS: restored LINE notification password, original destination/payload, success and failure states (delivery mocked)');

    await other.getByRole('button', { name: '設定', exact: true }).click();
    const blocked = dialog => dialog.accept();
    other.on('dialog', blocked);
    await other.getByRole('button', { name: /人員配置.*現場割り振り/ }).click();
    await other.getByRole('heading', { name: '設定メニュー', exact: true }).waitFor();
    other.off('dialog', blocked);
    await other.locator('button').first().click();
    const authenticate = async password => {
      const accept = dialog => dialog.type() === 'prompt' ? dialog.accept(password) : dialog.accept();
      other.on('dialog', accept);
      await other.getByRole('button', { name: '管理者認証', exact: true }).click();
      await other.getByRole('button', { name: password === '4043' ? '管理者解除' : '管理者認証', exact: true }).waitFor();
      other.off('dialog', accept);
    };
    await authenticate('wrong');
    assert.equal(await other.evaluate(() => localStorage.getItem('wb_admin_mode')), null);
    await authenticate('4043');
    await other.reload();
    await other.getByRole('button', { name: '管理者解除', exact: true }).waitFor();
    console.log('PASS: viewer cannot allocate, administrator authentication and persisted mode restored');
    await other.getByRole('button', { name: '設定', exact: true }).click();
    await other.getByRole('button', { name: /人員配置.*現場割り振り/ }).click();
    await other.getByText('佐藤', { exact: true }).click();
    await other.getByRole('button', { name: '運転手に指名' }).click();
    await register(page, 'p1');
    await other.getByRole('alert').filter({ hasText: '現場に配置されています：佐藤（第一現場）' }).waitFor();
    assert.equal(await other.getByText('運転手', { exact: true }).count() > 0, true);
    await other.getByRole('button', { name: '完了', exact: true }).click();
    await other.getByRole('button', { name: '高橋 選択 →' }).click();
    await other.getByRole('dialog', { name: '有給休暇の注意確認' }).waitFor();
    await other.getByRole('button', { name: '配置に戻る' }).click();
    await other.getByRole('button', { name: '完了', exact: true }).click();
    await other.getByRole('button', { name: '高橋 選択 →' }).click();
    await other.getByRole('button', { name: '確認して配置を完了' }).click();
    await other.getByRole('heading', { name: '現場配置表', exact: true }).waitFor();
    await other.waitForFunction(() => JSON.parse(localStorage.getItem('fixture_doc_app_data/shared_board')).lastUpdateInfo.includes('2026-10-28T03:00:00.000Z')).catch(async error => {
      console.log('completion state', await other.evaluate(() => ({ board: localStorage.getItem('fixture_doc_app_data/shared_board'), update: localStorage.getItem('wb_last_update'), writes: localStorage.getItem('fixture_writes') })));
      throw error;
    });
    assert.equal(await other.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('fixture_doc_app_data/shared_board')).people)[0].isDriver), true);
    assert.equal(await other.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('fixture_doc_app_data/shared_paid_leaves')).entries).length), 2);
    console.log('PASS: live leave changes preserve allocation drafts, warnings precede completion, roster saves preserve leave records');

    const releaseAdmin = dialog => dialog.accept();
    other.on('dialog', releaseAdmin);
    await other.getByRole('button', { name: '管理者解除', exact: true }).click();
    await other.getByRole('button', { name: '管理者認証', exact: true }).waitFor();
    other.off('dialog', releaseAdmin);
    assert.equal(await other.evaluate(() => localStorage.getItem('wb_admin_mode')), null);
    await other.getByText('佐藤', { exact: true }).click();
    await other.getByRole('button', { name: '変更する', exact: true }).click();
    await other.waitForFunction(() => JSON.parse(JSON.parse(localStorage.getItem('fixture_doc_app_data/shared_board')).people)[0].hasLunch === false);
    assert.equal(await other.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('fixture_doc_app_data/shared_board')).people)[0].isDriver), true);
    console.log('PASS: administrator release and viewer lunch updates preserve the saved allocation');
    await other.setViewportSize({ width: 375, height: 812 });
    assert.equal(await other.getByRole('button', { name: '管理者認証', exact: true }).isVisible(), true);
    assert.equal(await other.getByRole('button', { name: 'LINE通知', exact: true }).isVisible(), true);
    assert.equal(await other.getByRole('button', { name: '有給休暇', exact: true }).isVisible(), true);
    assert.equal(await other.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    console.log('PASS: restored administrator, notification, and leave controls all remain visible on mobile');

    fs.mkdirSync(path.resolve(__dirname, '..', 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, '..', 'test-results/calendar-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(__dirname, '..', 'test-results/calendar-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: '次の月' }).click();
    await page.getByRole('heading', { name: '2026年11月', exact: true }).waitFor();
    await page.getByRole('button', { name: '前の月' }).click();
    await page.getByRole('button', { name: '今日', exact: true }).click();
    await page.getByRole('heading', { name: /2026年10月28日/ }).waitFor();
    console.log('PASS: mobile width, month navigation, today navigation');
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await browser.close();
    await server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
