import bun from 'bun';
import YAML from 'yaml';
import * as TypesGameEntry from '../types/GameEntry.js';

type Freeze<T> = Readonly<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;
type AllRequired<T> = Required<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;

type ConfigType = AllRequired<
  Freeze<{
    discordWebhookList: string[];
    userList: {
      displayUserName: string;
      userName: string;
      loginType: 'username' | 'mail';
      hoyolabUid: number;
      discordUid: string;
      hoyolabCookieVersion: 1 | 2;
      hoyolabCookie: {
        ltoken: string;
      };
      hoyolabLang: string;
      enableService: Record<TypesGameEntry.GameEntry, boolean>;
    }[];
    // knownUsedCodes: {
    //   hoyolabUid: number;
    //   game: TypesGameEntry.RedeemGameEntry;
    //   region: string;
    //   code: string;
    // }[];
    knownUsedCodes: {
      [hoyolabUid: number]: Record<TypesGameEntry.RedeemGameEntry, { [region: string]: string[] }>;
    };
  }>
>;

const initialConfig: ConfigType = {
  discordWebhookList: ['https://discord.com/api/webhooks/hogehoge/fugafuga'],
  userList: [
    {
      displayUserName: 'Example User',
      userName: 'exampleuser',
      loginType: 'mail',
      hoyolabUid: 123456789,
      discordUid: '123456789012',
      hoyolabCookieVersion: 2,
      hoyolabCookie: { ltoken: 'hogehoge' },
      hoyolabLang: 'ja-jp',
      enableService: { hk4e: true, hkrpg: true, bh3: true, nap: true },
    },
  ],
  knownUsedCodes: {},
};

const filePath = 'config/config_auth.yaml';

if ((await bun.file(filePath).exists()) === false) {
  await bun.write(filePath, YAML.stringify(initialConfig, null, 2));
}

const config: ConfigType = YAML.parse(await bun.file(filePath).text());

export default config;
