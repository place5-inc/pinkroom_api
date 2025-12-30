import { HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { HairDesignVO, HairStyleVO, PromptVO } from 'src/libs/types';

@Injectable()
export class CommonService {
  constructor(private readonly db: DatabaseProvider) {}
  async getFileUrl(uploadFileId: string) {
    return this.db
      .selectFrom('upload_file')
      .select('url')
      .where('id', '=', uploadFileId)
      .executeTakeFirst();
  }
  async getStyleList(withDesign: boolean) {
    try {
      const styles = await this.db
        .selectFrom('code_hair_style')
        .select([
          'id',
          'name',
          'order_seq as orderSeq',
          'published_at as publishedAt',
        ])
        .orderBy('order_seq', 'asc')
        .execute();

      if (!withDesign) {
        return {
          status: HttpStatus.OK,
          list: styles,
        };
      }

      const designs = await this.db
        .selectFrom('code_hair_design')
        .select([
          'id',
          'style_id as styleId',
          'name',
          'order_seq as orderSeq',
          'published_at as publishedAt',
        ])
        .execute();

      const designMap = new Map<number, HairDesignVO[]>();

      for (const design of designs) {
        if (!designMap.has(design.styleId)) {
          designMap.set(design.styleId, []);
        }
        designMap.get(design.styleId)!.push({
          id: design.id,
          name: design.name,
        });
      }

      const list: HairStyleVO[] = styles.map((style) => ({
        ...style,
        designs: designMap.get(style.id) ?? [],
      }));

      return {
        status: HttpStatus.OK,
        list,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
  async getDesignList(withPrompt: boolean) {
    try {
      const designs = await this.db
        .selectFrom('code_hair_design')
        .select([
          'id',
          'name',
          'order_seq as orderSeq',
          'published_at as publishedAt',
        ])
        .orderBy('order_seq', 'asc')
        .execute();

      if (!withPrompt) {
        return {
          status: HttpStatus.OK,
          list: designs,
        };
      }

      // ✅ prompt + upload_file (1:1)
      const rows = await this.db
        .selectFrom('prompt')
        .leftJoin('upload_file', 'upload_file.id', 'prompt.upload_file_id')
        .select([
          'prompt.design_id as designId',
          'prompt.ment',
          'upload_file.id as imageId',
          'upload_file.url as imageUrl',
        ])
        .execute();

      /**
       * designId
       *   └─ PromptVO[]
       */
      const designMap = new Map<number, PromptVO[]>();

      for (const row of rows) {
        if (!designMap.has(row.designId)) {
          designMap.set(row.designId, []);
        }

        designMap.get(row.designId)!.push({
          designId: row.designId,
          ment: row.ment,
          image: row.imageId
            ? {
                id: row.imageId,
                url: row.imageUrl,
              }
            : undefined,
        });
      }

      const list: HairDesignVO[] = designs.map((style) => ({
        ...style,
        designs: designMap.get(style.id) ?? [],
      }));

      return {
        status: HttpStatus.OK,
        list,
      };
    } catch (e) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: e.message,
      };
    }
  }
}
