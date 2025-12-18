import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from '../libs/db';
import { v4 } from 'uuid';
import { DateTime } from 'luxon';
import { Image, isValidImage, BusinessMemberVO } from 'src/libs/types';

export type ContainerName = 'business-images';
export type TableName = 'business_member' | 'business_images';

@Injectable()
export class AzureBlobService {
  private blobServiceClient: BlobServiceClient;

  constructor(private readonly db: DatabaseProvider) {
    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? 'koreanbridge';
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

    const sharedKeyCredential = new StorageSharedKeyCredential(
      account,
      accountKey,
    );

    this.blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      sharedKeyCredential,
    );
  }

  async uploadFile(containerName: ContainerName, fileData: string) {
    const containerClient =
      this.blobServiceClient.getContainerClient(containerName);

    const matches = fileData.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string');
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    const fileId = v4();
    const fileName = `${fileId}.${mimeType.split('/')[1]}`;

    // todo: insert files
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    const result = await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
      },
    });

    if (result.errorCode) {
      throw new Error(result.errorCode);
    }

    await this.db
      .insertInto('upload_file')
      .values({
        id: fileId,
        url: blockBlobClient.url,
        file_name: fileName,
        created_at: DateTime.now().toJSDate(),
      })
      .execute();

    return { uploadFileId: fileId, url: blockBlobClient.url };
  }
  async uploadFileImage(image?: Image) {
    if (image != null) {
      if (isValidImage(image.data)) {
        return await this.uploadFileForAdmin(image.data);
      }
    }
    return;
  }

  async uploadFileForAdmin(fileData: string) {
    const containerClient = this.blobServiceClient.getContainerClient('sbl');

    const matches = fileData.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string');
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    const fileId = v4();
    const fileName = `${fileId}.${mimeType.split('/')[1]}`;

    // todo: insert files
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    const result = await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
      },
    });

    if (result.errorCode) {
      throw new Error(result.errorCode);
    }

    return await this.db
      .insertInto('upload_file')
      .values({
        id: fileId,
        file_name: fileName,
        url: blockBlobClient.url,
        created_at: DateTime.now().toJSDate(),
      })
      .outputAll('inserted')
      .executeTakeFirst();
  }

  async deleteFile(
    containerName: ContainerName,
    tableName: TableName,
    id: string,
  ) {
    // const containerClient =
    //   this.blobServiceClient.getContainerClient(containerName);
    //잠시 주석
    // const file = await this.db
    //   .selectFrom(tableName)
    //   .selectAll()
    //   .where('id', '=', id)
    //   .executeTakeFirst();
    // if (!file) {
    //   throw new Error('File not found');
    // }
    // azure에서 삭제하지는 않는 것으로
  }
}
