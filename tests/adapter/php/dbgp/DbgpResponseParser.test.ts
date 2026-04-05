import { describe, it, expect } from 'vitest';
import {
  parseInitPacket,
  parseResponse,
  parseBreakpointResponse,
  parseStackFrames,
  parseProperties,
} from '../../../../src/adapter/php/dbgp/DbgpResponseParser.js';

describe('DbgpResponseParser', () => {
  describe('parseInitPacket', () => {
    it('parses Xdebug init packet', () => {
      const xml = `<?xml version="1.0" encoding="iso-8859-1"?>
        <init xmlns="urn:debugger_protocol_v1"
              fileuri="file:///var/www/app/public/index.php"
              language="PHP"
              protocol_version="1.0"
              appid="42"
              idekey="detective">
          <engine version="3.3.1">Xdebug</engine>
        </init>`;

      const result = parseInitPacket(xml);

      expect(result.fileUri).toBe('file:///var/www/app/public/index.php');
      expect(result.ideKey).toBe('detective');
      expect(result.language).toBe('PHP');
      expect(result.appId).toBe('42');
      expect(result.engine).toBe('Xdebug');
      expect(result.engineVersion).toBe('3.3.1');
    });
  });

  describe('parseResponse', () => {
    it('parses status response', () => {
      const xml = `<?xml version="1.0" encoding="iso-8859-1"?>
        <response xmlns="urn:debugger_protocol_v1"
                  command="run"
                  transaction_id="3"
                  status="break"
                  reason="ok"/>`;

      const result = parseResponse(xml);

      expect(result.command).toBe('run');
      expect(result.transactionId).toBe('3');
      expect(result.status).toBe('break');
      expect(result.reason).toBe('ok');
    });
  });

  describe('parseBreakpointResponse', () => {
    it('extracts breakpoint id', () => {
      const xml = `<?xml version="1.0" encoding="iso-8859-1"?>
        <response xmlns="urn:debugger_protocol_v1"
                  command="breakpoint_set"
                  transaction_id="2"
                  id="10001"
                  state="enabled"/>`;

      const response = parseResponse(xml);
      const bp = parseBreakpointResponse(response);

      expect(bp.id).toBe('10001');
      expect(bp.state).toBe('enabled');
    });
  });

  describe('parseStackFrames', () => {
    it('parses stack frames', () => {
      const xml = `<?xml version="1.0" encoding="iso-8859-1"?>
        <response xmlns="urn:debugger_protocol_v1"
                  command="stack_get"
                  transaction_id="4">
          <stack level="0" type="file"
                 filename="file:///var/www/app/app/Http/Controllers/OrderController.php"
                 lineno="25" where="store"/>
          <stack level="1" type="file"
                 filename="file:///var/www/app/vendor/laravel/framework/routing.php"
                 lineno="100" where="dispatch"/>
        </response>`;

      const response = parseResponse(xml);
      const frames = parseStackFrames(response);

      expect(frames).toHaveLength(2);
      expect(frames[0]!.level).toBe(0);
      expect(frames[0]!.filename).toBe(
        'file:///var/www/app/app/Http/Controllers/OrderController.php',
      );
      expect(frames[0]!.lineno).toBe(25);
      expect(frames[0]!.where).toBe('store');
    });
  });

  describe('parseProperties', () => {
    it('parses local variables', () => {
      const xml = `<?xml version="1.0" encoding="iso-8859-1"?>
        <response xmlns="urn:debugger_protocol_v1"
                  command="context_get"
                  transaction_id="5">
          <property name="$total" fullname="$total" type="int"><![CDATA[42]]></property>
          <property name="$name" fullname="$name" type="string" encoding="base64"><![CDATA[Sm9obg==]]></property>
        </response>`;

      const response = parseResponse(xml);
      const props = parseProperties(response);

      expect(props).toHaveLength(2);
      expect(props[0]!.name).toBe('$total');
      expect(props[0]!.type).toBe('int');
      expect(props[1]!.name).toBe('$name');
      expect(props[1]!.type).toBe('string');
      expect(props[1]!.value).toBe('John');
    });
  });
});
