import type { NcContext } from '../interface/config';
import { extractProps } from '../helpers/extractProps';
import { v4 as uuidv4 } from 'uuid';

export interface ProductMatchSourceType {
  id?: string;
  name?: string;
  code?: string;
  base_config?: string;
  is_active?: boolean;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

export default class ProductMatchSource implements ProductMatchSourceType {
  id?: string;
  name?: string;
  code?: string;
  base_config?: string;
  is_active?: boolean;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;

  constructor(source: Partial<ProductMatchSourceType>) {
    Object.assign(this, source);
  }

  public static castType(source: ProductMatchSource): ProductMatchSource {
    return source && new ProductMatchSource(source);
  }

  public static async insert(
    context: NcContext,
    source: Partial<ProductMatchSourceType>,
    ncMeta: any,
  ) {
    const insertObj = extractProps(source, [
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
      insertObj.id = uuidv4();
    }

    if (!insertObj.created_at) {
      insertObj.created_at = new Date().toISOString();
    }

    if (!insertObj.updated_at) {
      insertObj.updated_at = new Date().toISOString();
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      'nc_product_match_sources',
      insertObj,
    );

    return ProductMatchSource.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
    sourceId: string,
    source: Partial<ProductMatchSourceType>,
    ncMeta: any,
  ) {
    const updateObj = extractProps(source, [
      'name',
      'code',
      'base_config',
      'is_active',
      'updated_at',
      'updated_by',
    ]);

    updateObj.updated_at = new Date().toISOString();

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      'nc_product_match_sources',
      updateObj,
      sourceId,
    );

    return ProductMatchSource.get(context, sourceId, ncMeta);
  }

  public static async get(
    context: NcContext,
    sourceId: string,
    ncMeta: any,
  ) {
    const source = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      'nc_product_match_sources',
      sourceId,
    );

    return ProductMatchSource.castType(source);
  }

  public static async list(
    context: NcContext,
    limit = 50,
    offset = 0,
    ncMeta: any,
  ) {
    const sources = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      'nc_product_match_sources',
      {
        condition: { is_active: true },
        orderBy: { name: 'asc' },
        limit,
        offset,
      },
    );

    return sources.map((source: any) => ProductMatchSource.castType(source));
  }

  public static async delete(
    context: NcContext,
    sourceId: string,
    ncMeta: any,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      'nc_product_match_sources',
      sourceId,
    );
  }

  public static async getByCode(
    context: NcContext,
    code: string,
    ncMeta: any,
  ) {
    // First, try to find existing source
    const sources = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      'nc_product_match_sources',
      {
        condition: { code, is_active: true },
        limit: 1,
      },
    );

    if (sources.length > 0) {
      return ProductMatchSource.castType(sources[0]);
    }

    // If no source found, try to auto-create from existing external products
    // This ensures we only use data that already exists in the database
    const externalProducts = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      'nc_external_products',
      {
        condition: {},
        limit: 1000,
      },
    );

    // Look for products that match this source code in their URL
    const matchingProduct = externalProducts.find((product: any) => 
      product.url && product.url.includes(code)
    );

    if (matchingProduct) {
      // Auto-create source based on existing data
      const sourceId = `src-${code.replace(/[^a-zA-Z0-9]/g, '-')}-001`;
      const sourceName = code.charAt(0).toUpperCase() + code.slice(1);
      
      const newSource = await ProductMatchSource.insert(
        context,
        {
          id: sourceId,
          name: sourceName,
          code: code,
          base_config: JSON.stringify({ kind: 'ecommerce', url: '' }),
          is_active: true,
          created_by: 'auto-detected',
        },
        ncMeta,
      );

      return newSource;
    }

    return null;
  }
}
