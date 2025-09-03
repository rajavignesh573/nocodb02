"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const extractProps_1 = require("../helpers/extractProps");
const uuid_1 = require("uuid");
class ProductMatchSource {
    constructor(source) {
        Object.assign(this, source);
    }
    static castType(source) {
        return source && new ProductMatchSource(source);
    }
    static async insert(context, source, ncMeta) {
        const insertObj = (0, extractProps_1.extractProps)(source, [
            'id',
            'name',
            'code',
            'base_config',
            'is_active',
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
        const { id } = await ncMeta.metaInsert2(context.workspace_id, context.base_id, 'nc_product_match_sources', insertObj);
        return ProductMatchSource.get(context, id, ncMeta);
    }
    static async update(context, sourceId, source, ncMeta) {
        const updateObj = (0, extractProps_1.extractProps)(source, [
            'name',
            'code',
            'base_config',
            'is_active',
            'updated_at',
            'updated_by',
        ]);
        updateObj.updated_at = new Date().toISOString();
        await ncMeta.metaUpdate(context.workspace_id, context.base_id, 'nc_product_match_sources', updateObj, sourceId);
        return ProductMatchSource.get(context, sourceId, ncMeta);
    }
    static async get(context, sourceId, ncMeta) {
        const source = await ncMeta.metaGet2(context.workspace_id, context.base_id, 'nc_product_match_sources', sourceId);
        return ProductMatchSource.castType(source);
    }
    static async list(context, limit = 50, offset = 0, ncMeta) {
        const sources = await ncMeta.metaList2(context.workspace_id, context.base_id, 'nc_product_match_sources', {
            condition: { is_active: true },
            orderBy: { name: 'asc' },
            limit,
            offset,
        });
        return sources.map((source) => ProductMatchSource.castType(source));
    }
    static async delete(context, sourceId, ncMeta) {
        await ncMeta.metaDelete(context.workspace_id, context.base_id, 'nc_product_match_sources', sourceId);
    }
    static async getByCode(context, code, ncMeta) {
        // First, try to find existing source
        const sources = await ncMeta.metaList2(context.workspace_id, context.base_id, 'nc_product_match_sources', {
            condition: { code, is_active: true },
            limit: 1,
        });
        if (sources.length > 0) {
            return ProductMatchSource.castType(sources[0]);
        }
        // If no source found, try to auto-create from existing external products
        // This ensures we only use data that already exists in the database
        const externalProducts = await ncMeta.metaList2(context.workspace_id, context.base_id, 'nc_external_products', {
            condition: {},
            limit: 1000,
        });
        // Look for products that match this source code in their URL
        const matchingProduct = externalProducts.find((product) => product.url && product.url.includes(code));
        if (matchingProduct) {
            // Auto-create source based on existing data
            const sourceId = `src-${code.replace(/[^a-zA-Z0-9]/g, '-')}-001`;
            const sourceName = code.charAt(0).toUpperCase() + code.slice(1);
            const newSource = await ProductMatchSource.insert(context, {
                id: sourceId,
                name: sourceName,
                code: code,
                base_config: JSON.stringify({ kind: 'ecommerce', url: '' }),
                is_active: true,
                created_by: 'auto-detected',
            }, ncMeta);
            return newSource;
        }
        return null;
    }
}
exports.default = ProductMatchSource;
//# sourceMappingURL=ProductMatchSource.js.map