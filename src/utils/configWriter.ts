import YAML from 'yaml';
import appConfig from './config.js';

const filePath = 'config/config.yaml';

async function addKnownExpiredCodes(newCodes: string[]) {
  const newConfig: typeof appConfig = {
    ...appConfig,
    redemption: {
      ...appConfig.redemption,
      knownExpiredCodes: [...new Set([...appConfig.redemption.knownExpiredCodes, ...newCodes])],
    },
  };
  await Bun.write(filePath, YAML.stringify(newConfig));
}

export default { addKnownExpiredCodes };
