import { parseLocalDateTime } from '../../homeUtils';

export function getDealViewKey(deal, index = 0) {
  return String(
    deal?.id ??
      deal?.campaignId ??
      `${deal?.mineSource ?? 'campaign'}-${deal?.itemName ?? 'item'}-${deal?.expireTime ?? index}`
  );
}

export function getCampaignLifecycle(rawCampaign) {
  const statusSource = [
    rawCampaign?.status,
    rawCampaign?.campaignStatus,
    rawCampaign?.campaign_status,
    rawCampaign?.state,
  ]
    .find(Boolean)
    ?.toString()
    .toUpperCase();

  if (statusSource?.includes('CANCEL')) {
    return 'CANCELLED';
  }

  if (statusSource?.includes('COMPLETE') || statusSource?.includes('FINISH') || statusSource?.includes('ENDED')) {
    return 'COMPLETED';
  }

  const expireValue = rawCampaign?.expireTime ?? rawCampaign?.expire_time ?? rawCampaign?.meetupTime ?? rawCampaign?.meetup_time;
  const expireDate = parseLocalDateTime(expireValue);
  if (expireDate && expireDate.getTime() <= Date.now()) {
    return 'COMPLETED';
  }

  return 'ACTIVE';
}

export function getMineCampaignBucket(rawCampaign) {
  const statusSource = [
    rawCampaign?.status,
    rawCampaign?.campaignStatus,
    rawCampaign?.campaign_status,
    rawCampaign?.state,
  ]
    .find(Boolean)
    ?.toString()
    .toUpperCase();
  const participantStatusSource = [
    rawCampaign?.myParticipantStatus,
    rawCampaign?.my_participant_status,
    rawCampaign?.participantStatus,
    rawCampaign?.participant_status,
  ]
    .find(Boolean)
    ?.toString()
    .toUpperCase();

  const source = (rawCampaign?.mineSource ?? rawCampaign?.__mineSource ?? '').toString().toUpperCase();

  if (source === 'HOSTED') {
    if (['OPEN', 'FULL'].includes(statusSource)) {
      return 'ACTIVE';
    }

    if (['DELIVERED', 'COMPLETED'].includes(statusSource)) {
      return 'COMPLETED';
    }

    if (['CANCELLED', 'FAILED'].includes(statusSource)) {
      return 'FAILED';
    }

    if (['HOST_NO_SHOW'].includes(statusSource)) {
      return 'ISSUE';
    }
  }

  if (source === 'JOINED') {
    if (['JOINED'].includes(participantStatusSource)) {
      return 'ACTIVE';
    }

    if (['CONFIRMED', 'COMPLETED'].includes(participantStatusSource)) {
      return 'COMPLETED';
    }

    if (['DISPUTED', 'NO_SHOW'].includes(participantStatusSource)) {
      return 'ISSUE';
    }
  }

  return getCampaignLifecycle(rawCampaign);
}
