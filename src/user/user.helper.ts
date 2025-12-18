import { AllSelection } from 'kysely/dist/cjs/parser/select-parser';
import { DB } from 'src/libs/db/types';

export class UserHelper {
  // static toUser(
  //   user: AllSelection<DB, 'user'> & { nickname: string | null },
  // ): User {
  //   return {
  //     id: user.id,
  //     name: user.name,
  //     birthYear: user.birth_year,
  //     gender: user.gender as Gender,
  //     phoneNumber: user.phone_number,
  //     createdAt: user.created_at,
  //     referrerName: user.referrer_name,
  //     referrerPhoneNumber: user.referrer_phone_number,
  //     profile: {
  //       nickname: user.nickname, //here,
  //     },
  //   } as User;
  // }
}
