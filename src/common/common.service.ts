import { HttpStatus, Injectable } from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import {
  BusinessServiceCategoryVO,
  BusinessServiceItemVO,
  CodeBusinessAreaVO,
  Image,
} from 'src/libs/types';
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
}
