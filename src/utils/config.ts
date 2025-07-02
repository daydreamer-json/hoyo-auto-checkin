import bun from 'bun';
import YAML from 'yaml';
import * as TypesLogLevels from '../types/LogLevels';
import * as TypesGameEntry from '../types/GameEntry';

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
      userAgent: {
        // UA to hide the fact that the access is from this tool
        chromeWindows: string;
        curl: string;
        curlUnity: string;
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
    userAgent: {
      chromeWindows:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      curl: 'curl/8.4.0',
      curlUnity: 'UnityPlayer/2022.3.21f1 (UnityWebRequest/1.0, libcurl/8.5.0-DEV)',
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    },
    timeout: 20000,
    retryCount: 5,
  },
  threadCount: { network: 8 },
  cli: { autoExit: false },
  logger: {
    logLevel: 0,
    useCustomLayout: true,
    customLayoutPattern: '%[%d{hh:mm:ss.SSS} %-5.0p >%] %m',
  },
};

const filePath = 'config/config.yaml';

if ((await bun.file(filePath).exists()) === false) {
  await bun.write(filePath, YAML.stringify(initialConfig, null, 2));
}

const config: ConfigType = YAML.parse(await bun.file(filePath).text());

export default config;
