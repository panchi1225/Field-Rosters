const apps: any[] = [];
export const initializeApp = (options: unknown, name: string) => {
  const app = { options, name };
  apps.push(app);
  return app;
};
export const getApps = () => apps;
export const getApp = (name: string) => apps.find(app => app.name === name);
