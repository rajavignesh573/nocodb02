"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const extractProps_1 = require("../helpers/extractProps");
const uuid_1 = require("uuid");
class ProductMatchRule {
    constructor(rule) {
        Object.assign(this, rule);
    }
    static castType(rule) {
        return rule && new ProductMatchRule(rule);
    }
    static async insert(context, rule, ncMeta) {
        const insertObj = (0, extractProps_1.extractProps)(rule, [
            'id',
            'tenant_id',
            'name',
            'weights',
            'price_band_pct',
            'algorithm',
            'min_score',
            'is_default',
            'created_at',
            'created_by',
            'updated_at',
            'updated_by',
        ]);
        if (!insertObj.id) {
            insertObj.id = (0, uuid_1.v4)();
        }
        if (!insertObj.created_at) {
            insertObj.created_at = new Date().toISOString();
        }
        if (!insertObj.updated_at) {
            insertObj.updated_at = new Date().toISOString();
        }
        if (!insertObj.algorithm) {
            insertObj.algorithm = 'jarowinkler';
        }
        if (!insertObj.min_score) {
            insertObj.min_score = 0.65;
        }
        if (!insertObj.price_band_pct) {
            insertObj.price_band_pct = 15;
        }
        const { id } = await ncMeta.metaInsert2(context.workspace_id, context.base_id, 'nc_product_match_rules', insertObj);
        return this.getById(context, id, ncMeta);
    }
    static async getById(context, id, ncMeta) {
        const rule = await ncMeta.metaGet2(context.workspace_id, context.base_id, 'nc_product_match_rules', id);
        return this.castType(rule);
    }
    static async list(context, limit = 25, offset = 0, ncMeta) {
        const rules = await ncMeta.metaList2(context.workspace_id, context.base_id, 'nc_product_match_rules', {
            limit,
            offset,
            orderBy: {
                created_at: 'desc',
            },
        });
        return rules.map((rule) => this.castType(rule));
    }
    static async getDefault(context, ncMeta) {
        const rules = await ncMeta.metaList2(context.workspace_id, context.base_id, 'nc_product_match_rules', {
            condition: {
                is_default: true,
            },
            limit: 1,
        });
        return rules.length > 0 ? this.castType(rules[0]) : null;
    }
    static async update(context, id, rule, ncMeta) {
        const updateObj = (0, extractProps_1.extractProps)(rule, [
            'name',
            'weights',
            'price_band_pct',
            'algorithm',
            'min_score',
            'is_default',
            'updated_at',
            'updated_by',
        ]);
        updateObj.updated_at = new Date().toISOString();
        await ncMeta.metaUpdate(context.workspace_id, context.base_id, 'nc_product_match_rules', updateObj, id);
        return this.getById(context, id, ncMeta);
    }
    static async delete(context, id, ncMeta) {
        await ncMeta.metaDelete(context.workspace_id, context.base_id, 'nc_product_match_rules', id);
    }
}
exports.default = ProductMatchRule;
//# sourceMappingURL=ProductMatchRule.js.map