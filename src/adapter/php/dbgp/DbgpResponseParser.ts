import { XMLParser } from 'fast-xml-parser';
import type {
  DbgpInitPacket,
  DbgpResponse,
  DbgpBreakpointResponse,
  DbgpStackFrame,
  DbgpProperty,
} from './DbgpProtocol.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => name === 'stack' || name === 'property',
  htmlEntities: true,
  processEntities: false,
});

export function parseInitPacket(xml: string): DbgpInitPacket {
  const parsed = xmlParser.parse(xml);
  const init = parsed.init;

  return {
    fileUri: init['@_fileuri'] ?? '',
    ideKey: init['@_idekey'] ?? '',
    language: init['@_language'] ?? '',
    protocolVersion: init['@_protocol_version'] ?? '',
    appId: init['@_appid'] ?? '',
    engine: init.engine?.['#text'] ?? init.engine ?? '',
    engineVersion: init.engine?.['@_version'] ?? '',
  };
}

export function parseResponse(xml: string): DbgpResponse {
  const parsed = xmlParser.parse(xml);
  const rootKey = Object.keys(parsed).find((k) => k !== '?xml');
  if (!rootKey) throw new Error('Empty DBGp response');

  const root = parsed[rootKey];

  return {
    transactionId: root['@_transaction_id'] ?? '',
    command: root['@_command'] ?? rootKey,
    status: root['@_status'],
    reason: root['@_reason'],
    success: root['@_success'] === '1',
    children: root,
    raw: root,
  };
}

export function parseBreakpointResponse(response: DbgpResponse): DbgpBreakpointResponse {
  return {
    id: (response.raw['@_id'] as string) ?? '',
    state: (response.raw['@_state'] as string) ?? 'enabled',
  };
}

export function parseStackFrames(response: DbgpResponse): DbgpStackFrame[] {
  const raw = response.raw as Record<string, unknown>;
  const stacks = raw['stack'] as Array<Record<string, unknown>> | undefined;
  if (!stacks) return [];

  return stacks.map((s) => ({
    level: Number(s['@_level'] ?? 0),
    type: (s['@_type'] as string) ?? '',
    filename: (s['@_filename'] as string) ?? '',
    lineno: Number(s['@_lineno'] ?? 0),
    where: (s['@_where'] as string) ?? '',
  }));
}

export function parseProperties(response: DbgpResponse): DbgpProperty[] {
  const raw = response.raw as Record<string, unknown>;
  const props = raw['property'] as Array<Record<string, unknown>> | undefined;
  if (!props) return [];

  return props.map(parseProperty);
}

function parseProperty(raw: Record<string, unknown>): DbgpProperty {
  const encoding = raw['@_encoding'] as string | undefined;
  let value = raw['#text'] as string | undefined;

  if (value && encoding === 'base64') {
    value = Buffer.from(value, 'base64').toString('utf-8');
  }

  const childProps = raw['property'] as Array<Record<string, unknown>> | undefined;

  return {
    name: (raw['@_name'] as string) ?? '',
    fullname: (raw['@_fullname'] as string) ?? '',
    type: (raw['@_type'] as string) ?? 'undefined',
    encoding,
    value,
    numchildren: raw['@_numchildren'] !== undefined ? Number(raw['@_numchildren']) : undefined,
    classname: raw['@_classname'] as string | undefined,
    size: raw['@_size'] !== undefined ? Number(raw['@_size']) : undefined,
    children: childProps?.map(parseProperty),
  };
}
