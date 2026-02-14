
export enum Role {
  MANAGER = 'MANAGER',   // 管理職
  STAFF = 'STAFF',       // 職員
  OPERATOR = 'OPERATOR', // オペレーター
  WORKER = 'WORKER',     // 作業員
}

export interface Vehicle {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  name: string;
  role: Role;
  siteId: string | null; // null means unassigned
  hasLunch: boolean;     // 弁当の有無 (true: あり, false: なし)
  lunchOrder?: '事務所' | '現場' | null;  // 弁当の注文先
  vehicleId: string | null; // null means no vehicle assigned
  isDriver?: boolean;    // 運転手フラグ
}

export interface Site {
  id: string;
  name: string;
  order: number;
  groupOrder?: string[]; // グループ（車両IDまたはnull）の表示順序
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export type ViewMode = 
  | 'WHITEBOARD'
  | 'SETTINGS_MENU'
  | 'ALLOCATION'
  | 'DATA_MANAGEMENT_MENU'
  | 'SITE_MANAGEMENT'
  | 'PERSON_MANAGEMENT'
  | 'VEHICLE_MANAGEMENT'
  | 'CLOUD_SETTINGS';
