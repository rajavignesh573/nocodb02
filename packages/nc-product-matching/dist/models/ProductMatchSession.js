"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const extractProps_1 = require("../helpers/extractProps");
const uuid_1 = require("uuid");
class ProductMatchSession {
    constructor(session) {
        Object.assign(this, session);
    }
    static castType(session) {
        return session && new ProductMatchSession(session);
    }
    static async insert(context, session, ncMeta) {
        const insertObj = (0, extractProps_1.extractProps)(session, [
            'id',
            'tenant_id',
            'created_by',
            'note',
            'created_at',
            'updated_at',
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
        const { id } = await ncMeta.metaInsert2(context.workspace_id, context.base_id, 'nc_product_match_sessions', insertObj);
        return this.getById(context, id, ncMeta);
    }
    static async getById(context, id, ncMeta) {
        const session = await ncMeta.metaGet2(context.workspace_id, context.base_id, 'nc_product_match_sessions', id);
        return this.castType(session);
    }
    static async list(context, limit = 25, offset = 0, ncMeta) {
        const sessions = await ncMeta.metaList2(context.workspace_id, context.base_id, 'nc_product_match_sessions', {
            limit,
            offset,
            orderBy: {
                created_at: 'desc',
            },
        });
        return sessions.map((session) => this.castType(session));
    }
    static async update(context, id, session, ncMeta) {
        const updateObj = (0, extractProps_1.extractProps)(session, [
            'note',
            'updated_at',
        ]);
        updateObj.updated_at = new Date().toISOString();
        await ncMeta.metaUpdate(context.workspace_id, context.base_id, 'nc_product_match_sessions', updateObj, id);
        return this.getById(context, id, ncMeta);
    }
    static async delete(context, id, ncMeta) {
        await ncMeta.metaDelete(context.workspace_id, context.base_id, 'nc_product_match_sessions', id);
    }
}
exports.default = ProductMatchSession;
//# sourceMappingURL=ProductMatchSession.js.map