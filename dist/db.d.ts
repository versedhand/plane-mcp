import pg from 'pg';
export type InstanceName = 'personal' | 'nts';
interface InstanceConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    workspaceSlug: string;
}
export declare function getInstanceConfig(instance: InstanceName): InstanceConfig;
export declare function getPool(instance?: InstanceName): pg.Pool;
export declare function getWorkspaceSlug(instance?: InstanceName): string;
export declare function getAvailableInstances(): InstanceName[];
export declare function getLifedbPool(): pg.Pool;
export declare function query(sql: string, params?: any[], instance?: InstanceName): Promise<any[]>;
export declare function execute(sql: string, params?: any[], instance?: InstanceName): Promise<string>;
export declare function shutdown(): Promise<void>;
export {};
