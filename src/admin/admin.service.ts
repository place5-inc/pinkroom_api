import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseProvider } from 'src/libs/db';
import {
  BusinessVO,
  Subway,
  DTO,
  BusinessServiceCategoryVO,
  BusinessServiceItemVO,
  BusinessSectionVO,
  BusinessMemberVO,
  BusinessReviewVO,
  BusinessScheduleVO,
  BusinessPriceVO,
  Image,
  BusinessDetailVO,
  BusinessType,
  BusinessStatusType,
  BusinessSectionType,
  isValidBusinessSectionType,
  isValidBusinessReviewType,
  BusinessReviewType,
} from 'src/libs/types';
import { isEmpty, isNull } from 'src/libs/helpers';
import { UpdateObjectExpression } from 'kysely/dist/cjs/parser/update-set-parser';
import { DB } from 'src/libs/db/types';
import { AdminRepository } from './admin.repository';

import { AllSelection } from 'kysely/dist/cjs/parser/select-parser';
import { DateTime } from 'luxon';
@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseProvider,
    private readonly adminRepository: AdminRepository,
  ) {}
}
