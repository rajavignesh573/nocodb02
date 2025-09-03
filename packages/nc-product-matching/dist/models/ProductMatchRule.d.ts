import type { NcContext } from '../interface/config';
export interface ProductMatchRuleType {
    id?: string;
    tenant_id?: string;
    name?: string;
    weights?: string;
    price_band_pct?: number;
    algorithm?: string;
    min_score?: number;
    is_default?: boolean;
    created_at?: string;
    created_by?: string;
    updated_at?: string;
    updated_by?: string;
}
export default class ProductMatchRule implements ProductMatchRuleType {
    id?: string;
    tenant_id?: string;
    name?: string;
    weights?: string;
    price_band_pct?: number;
    algorithm?: string;
    min_score?: number;
    is_default?: boolean;
    created_at?: string;
    created_by?: string;
    updated_at?: string;
    updated_by?: string;
    constructor(rule: Partial<ProductMatchRuleType>);
    static castType(rule: ProductMatchRule): ProductMatchRule;
    static insert(context: NcContext, rule: Partial<ProductMatchRuleType>, ncMeta: any): Promise<ProductMatchRule>;
    static getById(context: NcContext, id: string, ncMeta: any): Promise<ProductMatchRule>;
    static list(context: NcContext, limit: number | undefined, offset: number | undefined, ncMeta: any): Promise<ProductMatchRule[]>;
    static getDefault(context: NcContext, ncMeta: any): Promise<ProductMatchRule | null>;
    static update(context: NcContext, id: string, rule: Partial<ProductMatchRuleType>, ncMeta: any): Promise<ProductMatchRule>;
    static delete(context: NcContext, id: string, ncMeta: any): Promise<void>;
}
//# sourceMappingURL=ProductMatchRule.d.ts.map