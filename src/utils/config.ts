import deepmerge from 'deepmerge';
import YAML from 'yaml';
import * as TypesGameEntry from '../types/GameEntry.js';
import * as TypesLogLevels from '../types/LogLevels.js';

type Freeze<T> = Readonly<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;
type AllRequired<T> = Required<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;

type ConfigType = AllRequired<
  Freeze<{
    network: {
      signApi: Record<TypesGameEntry.GameEntry, { url: string; qs: { act_id: string } }>;
      redeemApi: Record<TypesGameEntry.RedeemGameEntry, { url: string; qs: { game_biz: string } }>;
      redeemSearchApi: Record<TypesGameEntry.RedeemGameEntry, { url: string; qs: { game_id: number } }>;
      accountApi: { getServer: { url: string }; getGameData: { url: string } };
      hoyolabCommunityApi: { searchPost: { url: string }; getPostFull: { url: string } };
      userAgent: {
        // UA to hide the fact that the access is from this tool
        chromeWindows: string;
        curl: string;
        ios: string;
      };
      timeout: number; // Network timeout
      retryCount: number; // Number of retries for access failure
    };
    threadCount: {
      // Upper limit on the number of threads for parallel processing
      network: number; // network access
    };
    cli: {
      autoExit: boolean; // Whether to exit the tool without waiting for key input when the exit code is 0
    };
    logger: {
      // log4js-node logger settings
      logLevel: TypesLogLevels.LogLevelNumber;
      useCustomLayout: boolean;
      customLayoutPattern: string;
    };
    redemption: {
      knownIndefiniteCodes: Record<TypesGameEntry.RedeemGameEntry, string>;
      knownExpiredCodes: string[];
    };
  }>
>;

const initialConfig: ConfigType = {
  network: {
    signApi: {
      hk4e: { url: 'sg-hk4e-api.hoyolab.com/event/sol/sign', qs: { act_id: 'e202102251931481' } },
      hkrpg: { url: 'sg-public-api.hoyolab.com/event/luna/os/sign', qs: { act_id: 'e202303301540311' } },
      bh3: { url: 'sg-public-api.hoyolab.com/event/mani/sign', qs: { act_id: 'e202110291205111' } },
      nap: { url: 'sg-public-api.hoyolab.com/event/luna/zzz/os/sign', qs: { act_id: 'e202406031448091' } },
    },
    redeemApi: {
      hk4e: {
        url: 'public-operation-hk4e.hoyolab.com/common/apicdkey/api/webExchangeCdkeyHyl',
        qs: { game_biz: 'hk4e_global' },
      },
      hkrpg: {
        url: 'public-operation-hkrpg.hoyolab.com/common/apicdkey/api/webExchangeCdkeyHyl',
        qs: { game_biz: 'hk4e_global' },
      },
      nap: {
        url: 'public-operation-nap.hoyolab.com/common/apicdkey/api/webExchangeCdkeyHyl',
        qs: { game_biz: 'nap_global' },
      },
    },
    redeemSearchApi: {
      hk4e: { url: 'bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material', qs: { game_id: 2 } },
      hkrpg: { url: 'bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material', qs: { game_id: 6 } },
      nap: { url: 'bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material', qs: { game_id: 8 } },
    },
    accountApi: {
      getServer: { url: 'api-account-os.hoyolab.com/binding/api/getAllRegions' },
      getGameData: { url: 'api-account-os.hoyolab.com/binding/api/getUserGameRolesByLtoken' },
    },
    hoyolabCommunityApi: {
      searchPost: { url: 'bbs-api-os.hoyolab.com/community/search/wapi/search/post' },
      getPostFull: { url: 'bbs-api-os.hoyolab.com/community/post/wapi/getPostFull' },
    },
    userAgent: {
      chromeWindows:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      curl: 'curl/8.4.0',
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    },
    timeout: 20000,
    retryCount: 5,
  },
  threadCount: { network: 16 },
  cli: { autoExit: false },
  logger: {
    logLevel: 0,
    useCustomLayout: true,
    customLayoutPattern: '%[%d{hh:mm:ss.SSS} %-5.0p >%] %m',
  },
  redemption: {
    knownIndefiniteCodes: { hk4e: 'GENSHINGIFT', hkrpg: 'STARRAILGIFT', nap: 'ZENLESSGIFT' },
    knownExpiredCodes: [],
  },
};

const filePath = 'config/config.yaml';

if ((await Bun.file(filePath).exists()) === false) {
  await Bun.write(filePath, YAML.stringify(initialConfig));
}

const config: ConfigType = await (async () => {
  const rawFileData: ConfigType = YAML.parse(await Bun.file(filePath).text()) as ConfigType;
  const mergedConfig = deepmerge(initialConfig, rawFileData, {
    arrayMerge: (_destinationArray, sourceArray) => sourceArray,
  });
  if (JSON.stringify(rawFileData) !== JSON.stringify(mergedConfig)) {
    await Bun.write(filePath, YAML.stringify(mergedConfig));
  }
  return mergedConfig;
})();

export default config;
