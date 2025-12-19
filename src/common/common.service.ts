import { HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { HairDesignVO, HairStyleVO, Image, PromptVO } from 'src/libs/types';
import { isEmpty, isNull } from 'src/libs/helpers';
import { AzureBlobService } from 'src/azure/blob.service';
import { DateTime } from 'luxon';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
@Injectable()
export class CommonService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
    private readonly httpService: HttpService,
  ) {}

  async getSytleList(withDesign: boolean) {
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

      const prompts = await this.db
        .selectFrom('prompt')
        .select(['design_id as designId', 'ment'])
        .execute();

      const designMap = new Map<number, PromptVO[]>();

      for (const prompt of prompts) {
        if (!designMap.has(prompt.designId)) {
          designMap.set(prompt.designId, []);
        }
        designMap.get(prompt.designId)!.push({
          designId: prompt.designId,
          ment: prompt.ment,
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
