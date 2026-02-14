
import { Person, Role, Site, Vehicle } from './types';

export const ROLE_LABELS: Record<Role, string> = {
  [Role.MANAGER]: '管理職',
  [Role.STAFF]: '職員',
  [Role.OPERATOR]: 'オペレーター',
  [Role.WORKER]: '作業員',
};

// 指定された現場データ
export const INITIAL_SITES: Site[] = [
  { id: 'site-1', name: 'R7･8•9江戸川上流左岸河川維持工事', order: 0 },
  { id: 'site-2', name: 'R7江戸川右岸下内川地先堤防整備工事', order: 1 },
  { id: 'site-3', name: 'R7稲戸井調節池土砂掘削その5工事', order: 2 },
  { id: 'site-4', name: 'R6江戸川左岸平方村新田地先堤防整備工事', order: 3 },
  { id: 'site-5', name: '公共運動公園周辺地区整備工事（R7芝崎地区粗造成その2）', order: 4 },
  { id: 'site-6', name: '県単舗装道路修繕工事（上花輪）', order: 5 },
  { id: 'site-7', name: 'R7･R8目吹管内右岸河川維持工事', order: 6 },
  { id: 'site-8', name: 'R5･6･7江戸川上流左岸河川維持工事', order: 7 },
  { id: 'site-9', name: '栗堀', order: 8 },
  { id: 'site-10', name: '置場', order: 9 },
  { id: 'site-11', name: '本社', order: 10 },
];

// 既存データ + テスト用データ (車両15台追加)
const extraVehicles: Vehicle[] = Array.from({ length: 15 }, (_, i) => ({
  id: `v-test-${i + 1}`,
  name: `車両 ${i + 4}号`,
}));

export const INITIAL_VEHICLES: Vehicle[] = [
  { id: 'v-1', name: 'ハイエース 1号車' },
  { id: 'v-2', name: 'ダンプ A' },
  { id: 'v-3', name: '軽トラ' },
  ...extraVehicles,
];

// 人員名簿の定義
export const INITIAL_PEOPLE: Person[] = [
  // 管理職
  { id: 'p-m-1', name: '松浦 信一', role: Role.MANAGER, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-m-2', name: '松浦 宏統', role: Role.MANAGER, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-m-3', name: '松浦 善統', role: Role.MANAGER, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },

  // 職員
  { id: 'p-s-1', name: '廣崎 錦也', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-2', name: '大竹 康雄', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-3', name: '柏木 健', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-4', name: '品村 正人', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-5', name: '荘司 晃彰', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-6', name: '大須賀 久敬', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-7', name: '大山 聖人', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-8', name: '深津 裕司', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-9', name: '福士 和久', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-10', name: '鳥山 潤人', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-11', name: '王田 博文', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-12', name: '竹内 勝', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-s-13', name: '新田 琳央', role: Role.STAFF, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },

  // オペレーター
  { id: 'p-o-1', name: '佐藤 和則', role: Role.OPERATOR, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-o-2', name: '北林 信也', role: Role.OPERATOR, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-o-3', name: '新田 健二', role: Role.OPERATOR, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },

  // 作業員
  { id: 'p-w-1', name: '島森 金一郎', role: Role.WORKER, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-w-2', name: '片野 茂夫', role: Role.WORKER, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-w-3', name: '舘末 末吉', role: Role.WORKER, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-w-4', name: '中澤 浩', role: Role.WORKER, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-w-5', name: 'ニア', role: Role.WORKER, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-w-6', name: '古橋 歩夢', role: Role.WORKER, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
  { id: 'p-w-7', name: '三浦 星矢', role: Role.WORKER, siteId: null, hasLunch: false, vehicleId: null, isDriver: false },
];
