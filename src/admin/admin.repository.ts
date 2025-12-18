import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import { Image } from 'src/libs/types';
import { DateTime } from 'luxon';
import {
  TableName,
  ContainerName,
  AzureBlobService,
} from 'src/azure/blob.service';
import { isEmpty, isNull } from 'src/libs/helpers';

@Injectable()
export class AdminRepository {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly azureBlobService: AzureBlobService,
  ) {}

  async uploadBusinessImages(containerName: ContainerName, image: Image) {
    if (isNull(image)) {
      return null;
    }

    if (!isEmpty(image.id) || !isEmpty(image.url)) {
      return null;
    }

    if (!isEmpty(image.data)) {
      const { uploadFileId, url } = await this.azureBlobService.uploadFile(
        containerName,
        image.data,
      );
      return { uploadFileId, url };
    }
  }
  async uploadBusinessMemberImages(containerName: ContainerName, image: Image) {
    if (isNull(image)) {
      return null;
    }

    if (!isEmpty(image.id) || !isEmpty(image.url)) {
      return null;
    }

    if (!isEmpty(image.data)) {
      const { uploadFileId, url } = await this.azureBlobService.uploadFile(
        containerName,
        image.data,
      );
      return { uploadFileId, url };
    }
  }
}
