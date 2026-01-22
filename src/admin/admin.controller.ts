import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { isEmpty } from 'src/libs/helpers';
import { AdminService } from './admin.service';
import { CommonService } from 'src/common/common.service';
import { AdminBody } from 'src/libs/types';
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly commonService: CommonService,
  ) {}
  @Get('test')
  async test() {
    return await this.adminService.test();
  }
  @Get('style')
  async getStyleList(
    @Query('withDesign', new ParseBoolPipe({ optional: true }))
    withDesign = false,
  ) {
    return await this.commonService.getStyleList(withDesign);
  }
  @Post('style')
  async addStyle(@Body() body: AdminBody) {
    if (isEmpty(body.name)) {
      throw new BadRequestException('name is required.');
    }
    return await this.adminService.addStyle(body.name);
  }
  @Patch('style')
  async updateStyle(@Body() body: AdminBody) {
    if (isEmpty(body.id)) {
      throw new BadRequestException('id is required.');
    }
    if (isEmpty(body.name)) {
      throw new BadRequestException('name is required.');
    }
    return await this.adminService.updateStyle(body.id, body.name);
  }
  @Post('style/publish')
  async publishStyle(@Body() body: AdminBody) {
    if (isEmpty(body.id)) {
      throw new BadRequestException('id is required.');
    }
    if (isEmpty(body.setOn)) {
      throw new BadRequestException('setOn is required.');
    }
    return await this.adminService.publishStyle(body.id, body.setOn);
  }
  @Get('design')
  async getDesignList(
    @Query('withPrompt', new ParseBoolPipe({ optional: true }))
    withPrompt = false,
  ) {
    return await this.commonService.getDesignList(withPrompt);
  }
  @Post('design')
  async addDesign(@Body() body: AdminBody) {
    if (isEmpty(body.name)) {
      throw new BadRequestException('name is required.');
    }
    if (isEmpty(body.styleId)) {
      throw new BadRequestException('styleId is required.');
    }
    return await this.adminService.addDesign(body.styleId, body.name);
  }
  @Patch('design')
  async updateDesign(@Body() body: AdminBody) {
    if (isEmpty(body.id)) {
      throw new BadRequestException('id is required.');
    }
    if (isEmpty(body.name)) {
      throw new BadRequestException('name is required.');
    }
    return await this.adminService.updateDesign(body.id, body.name);
  }
  @Post('design/publish')
  async publishDesign(@Body() body: AdminBody) {
    if (isEmpty(body.id)) {
      throw new BadRequestException('id is required.');
    }
    if (isEmpty(body.setOn)) {
      throw new BadRequestException('setOn is required.');
    }
    return await this.adminService.publishDesign(body.id, body.setOn);
  }
  @Post('prompt')
  async updatePrompt(@Body() body: AdminBody) {
    if (isEmpty(body.designId)) {
      throw new BadRequestException('designId is required.');
    }
    if (isEmpty(body.ment)) {
      throw new BadRequestException('ment is required.');
    }
    return await this.adminService.updatePrompt(
      body.designId,
      body.ment,
      body.image,
    );
  }

  @Get('prompt')
  async getPrompt(@Query('designId') designId: number) {
    return await this.adminService.getPrompt(designId);
  }
  @Post('prompt/test')
  async generatePhotoAdminTest(@Body() body: AdminBody) {
    if (isEmpty(body.image)) {
      throw new BadRequestException('image is required.');
    }
    if (isEmpty(body.ment)) {
      throw new BadRequestException('ment is required.');
    }
    return await this.adminService.generatePhotoAdminTest(
      body.image,
      body.ment,
      body.ai ?? 'gemini',
    );
  }

  @Get('change/phone')
  async changePhone(
    @Query('before') before: string,
    @Query('after') after: string,
  ) {
    if (isEmpty(before)) {
      throw new BadRequestException('before is required.');
    }
    if (isEmpty(after)) {
      throw new BadRequestException('after is required.');
    }
    return await this.adminService.changePhone(before, after);
  }
  @Get('gemini/reset')
  async geminiReset() {
    return await this.adminService.geminiReset();
  }
  @Get('getCertiCode')
  async getCertiCode(@Query('phone') phone: string) {
    return await this.adminService.getCertiCode(phone);
  }
  @Get('actionLog')
  async getActionLog(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return await this.adminService.getActionLog(page);
  }
  @Get('phone')
  async getPhotos(@Query('phone') phone: string) {
    return await this.adminService.getPhotos(phone);
  }
  @Post('generate')
  async generateImage(@Body() body: AdminBody) {
    return await this.adminService.generateImage(body.photoId, body.designId);
  }
  @Post('photo/save')
  async savePhotos(@Body() body: AdminBody) {
    return await this.adminService.savePhotos(
      body.photoId,
      body.designId,
      body.image.id,
    );
  }
  @Get('reboot')
  async reboot() {
    return await this.adminService.reboot();
  }

  @Get('fail')
  async getFailList() {
    return await this.adminService.getFailList();
  }
}
