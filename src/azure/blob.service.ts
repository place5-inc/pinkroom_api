import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { Injectable } from '@nestjs/common';
import { DatabaseProvider } from '../libs/db';
const sharp = require('sharp') as typeof import('sharp');
import { v4 } from 'uuid';
import { DateTime } from 'luxon';
import { Image, isValidImage } from 'src/libs/types';

export type ContainerName = 'photo';
export type TableName = 'upload_file';

@Injectable()
export class AzureBlobService {
  private blobServiceClient: BlobServiceClient;

  constructor(private readonly db: DatabaseProvider) {
    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? 'pinkroom';
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
  async uploadFileImageBase64(image?: string, toWebp = false) {
    if (image != null) {
      if (isValidImage(image)) {
        return await this.uploadFileForAdmin(image, toWebp);
      }
    }
    return;
  }
  async uploadFileForAdmin(fileData: string, toWebp = false) {
    const containerClient =
      this.blobServiceClient.getContainerClient('pinkroom');

    const matches = fileData.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string');
    }

    const originalMimeType = matches[1]; // ex) image/png
    let buffer: Buffer = Buffer.from(matches[2], 'base64');

    // ✅ 옵션이 true일 때만 webp 변환
    let mimeType = originalMimeType;
    if (toWebp) {
      buffer = await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true }) // 필요 없으면 이 줄 제거 가능
        .webp({ quality: 80 })
        .toBuffer();

      mimeType = 'image/webp';
    }

    const fileId = v4();

    // ✅ 확장자: webp면 webp로, 아니면 원래 mimeType 기반
    const ext = toWebp ? 'webp' : (mimeType.split('/')[1] ?? 'bin');
    const fileName = `${fileId}.${ext}`;

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    const result = await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
        // 필요하면 캐싱
        // blobCacheControl: 'public, max-age=31536000, immutable',
      },
    });

    if ((result as any).errorCode) {
      throw new Error((result as any).errorCode);
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
