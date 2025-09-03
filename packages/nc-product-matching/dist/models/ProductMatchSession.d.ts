import type { NcContext } from '../interface/config';
export interface ProductMatchSessionType {
    id?: string;
    tenant_id?: string;
    created_by?: string;
    note?: string;
    created_at?: string;
    updated_at?: string;
}
export default class ProductMatchSession implements ProductMatchSessionType {
    id?: string;
    tenant_id?: string;
    created_by?: string;
    note?: string;
    created_at?: string;
    updated_at?: string;
    constructor(session: Partial<ProductMatchSessionType>);
    static castType(session: ProductMatchSession): ProductMatchSession;
    static insert(context: NcContext, session: Partial<ProductMatchSessionType>, ncMeta: any): Promise<ProductMatchSession>;
    static getById(context: NcContext, id: string, ncMeta: any): Promise<ProductMatchSession>;
    static list(context: NcContext, limit: number | undefined, offset: number | undefined, ncMeta: any): Promise<ProductMatchSession[]>;
    static update(context: NcContext, id: string, session: Partial<ProductMatchSessionType>, ncMeta: any): Promise<ProductMatchSession>;
    static delete(context: NcContext, id: string, ncMeta: any): Promise<void>;
}
//# sourceMappingURL=ProductMatchSession.d.ts.map