import YAML from 'yaml';
import * as TypesGameEntry from '../types/GameEntry.js';
import redeemUtils from '../utils/redeem.js';
import appConfig from './config.js';
import configAuth from './configAuth.js';

async function addKnownExpiredCodes(newCodes: string[]) {
  const filePath = 'config/config.yaml';
  const newConfig: typeof appConfig = {
    ...appConfig,
    redemption: {
      ...appConfig.redemption,
      knownExpiredCodes: [...new Set([...appConfig.redemption.knownExpiredCodes, ...newCodes])],
    },
  };
  await Bun.write(filePath, YAML.stringify(newConfig));
}

async function addKnownUsedCodes(
  redeemResultArray: {
    hoyolabUid: number;
    game: TypesGameEntry.RedeemGameEntry;
    game_biz: string;
    account: { region: string; game_uid: string; nickname: string; level: number };
    code: string;
    result: Awaited<ReturnType<typeof redeemUtils.doRedeemCode>>;
  }[],
) {
  const filePath = 'config/config_auth.yaml';
  const newConfig: typeof configAuth = JSON.parse(JSON.stringify(configAuth));

  if (!newConfig.knownUsedCodes) {
    newConfig.knownUsedCodes = {};
  }
  let hasChanges = false;

  for (const item of redeemResultArray) {
    if (item.result.resultType !== 'ok' && item.result.resultType !== 'used') continue;
    const { hoyolabUid, game, code } = item;
    const { region } = item.account;
    if (!newConfig.knownUsedCodes[hoyolabUid]) newConfig.knownUsedCodes[hoyolabUid] = {};
    const userEntry = newConfig.knownUsedCodes[hoyolabUid]!;
    if (!userEntry[game]) userEntry[game] = {};
    const gameEntry = userEntry[game]!;
    if (!gameEntry[region]) {
      gameEntry[region] = [code];
      hasChanges = true;
    } else {
      if (!gameEntry[region]!.includes(code)) {
        gameEntry[region]!.push(code);
        hasChanges = true;
      }
    }
  }

  if (!hasChanges) return;

  const doc = new YAML.Document(newConfig);
  YAML.visit(doc, {
    Seq(_key, node, path) {
      const isUnderKnownUsedCodes = path.some((item: any) => {
        if (YAML.isPair(item)) {
          const key = item.key;
          return (
            key === 'knownUsedCodes' ||
            (key && typeof key === 'object' && 'value' in key && key.value === 'knownUsedCodes')
          );
        }
        return false;
      });
      if (isUnderKnownUsedCodes) node.flow = true;
    },
  });
  await Bun.write(Bun.file(filePath), doc.toString({ lineWidth: -1, flowCollectionPadding: false }));
}

export default { addKnownExpiredCodes, addKnownUsedCodes };
