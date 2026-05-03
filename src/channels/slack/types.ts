/**
 * Slack Channel — Slack Web API integration for synthtek
 */

export interface SlackConfig {
  token: string;
  signingSecret?: string;
  botUserId?: string;
  useRtm?: boolean;
  rtmSocketTimeout?: number;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  enableStreaming?: boolean;
  threadMode?: 'auto' | 'manual' | 'disabled';
}

export interface SlackMessage {
  messageId: string;
  channelId: string;
  threadTs?: string;
  fromId: string;
  fromUsername?: string;
  fromName?: string;
  text: string;
  isBotMessage: boolean;
  ts: string;
  messageType: 'message' | 'bot_message' | 'me_message' | 'channel_join' | 'group_join' | 'unknown';
  files: Array<{
    id: string;
    name: string;
    mimetype: string;
    size: number;
    url: string;
  }>;
  imageUrls: string[];
  replyToTs?: string;
  parentUserId?: string;
  channelType: string;
  isEdited: boolean;
  editedTs?: string;
}

export interface SlackSendOptions {
  replyToMessageId?: string;
  threadTs?: string;
  replyBroadcast?: boolean;
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
  channel?: string;
  mrkdwn?: boolean;
}

export interface SlackBlockKit {
  type: string;
  [key: string]: unknown;
}

export interface SlackAttachment {
  fallback: string;
  title?: string;
  title_link?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  text: string;
  channel?: string;
  ts?: string;
  color?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  footer_icon?: string;
  timestamp?: number;
  image_url?: string;
  thumb_url?: string;
  file_id?: string;
}

export interface SlackBlockMessage {
  blocks: SlackBlockKit[];
  text?: string;
  reply_broadcast?: boolean;
  thread_ts?: string;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
  me: boolean;
}

export interface SlackChannelInfo {
  id: string;
  name: string;
  type: 'im' | 'mpim' | 'channel' | 'group' | 'unknown';
  isPrivate: boolean;
  isChannel: boolean;
  isGroup: boolean;
  isIm: boolean;
  isMpim: boolean;
  nameNormalized: string;
  created: number;
  creator: string;
  isExtShared: boolean;
  isShared: boolean;
  isOrgShared: boolean;
  pendingShared: boolean;
  unreadCount: number;
  unreadCountTs: string;
  general: boolean;
  archived: boolean;
  priority: number;
  topic?: { value: string; creator?: string; lastSet?: number };
  purpose?: { value: string; creator?: string; lastSet?: number };
  previousNames?: string[];
  numMembers?: number;
}

export interface SlackUserInfo {
  id: string;
  username: string;
  name: string;
  realName: string;
  tz?: string;
  tzLabel?: string;
  tzOffset?: number;
  profile?: {
    title?: string;
    phone?: string;
    realName?: string;
    realNameNormalized?: string;
    displayName?: string;
    displayNameNormalized?: string;
    statusText?: string;
    statusTextCanonical?: string;
    statusEmoji?: string;
    avatarHash?: string;
    imageUrl?: string;
    imageUrlOriginal?: string;
    image24?: string;
    image32?: string;
    image48?: string;
    image72?: string;
    image192?: string;
    image512?: string;
    image1024?: string;
    imageOriginal?: string;
  };
  isAdmin: boolean;
  isOwner: boolean;
  isPrimaryOwner: boolean;
  isRestricted: boolean;
  isUltraRestricted: boolean;
  isBot: boolean;
  isAppUser: boolean;
  updated: number;
  email?: string;
  teamId: string;
}

export interface SlackTeamInfo {
  id: string;
  name: string;
  domain: string;
  emailDomain: string;
  icon: { imageOriginal: string; imageDefault: string };
}

export interface SlackFile {
  id: string;
  created: number;
  timestamp: number;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  prettyType: string;
  user: string;
  userTeam: string;
  editable: boolean;
  size: number;
  mode: string;
  isExternal: boolean;
  externalType: string;
  isPublic: boolean;
  publicUrlShared: boolean;
  displayAsBot: boolean;
  xssDetected: boolean;
  filename: string;
  permalink: string;
  permalinkPublic: string;
  preview: string;
  previewHighlight: string;
  urlPrivate: string;
  urlPrivateDownload: string;
}

export interface SlackUploadOptions {
  channels?: string[];
  filename?: string;
  title?: string;
  initialComment?: string;
  threadTs?: string;
  filetype?: string;
  altTxt?: string;
  snippetFile?: boolean;
}

export interface SlackUploadResult {
  ok: boolean;
  file?: SlackFile;
  error?: string;
}

export interface SlackUploadProgress {
  loaded: number;
  total: number;
  percent: number;
}
