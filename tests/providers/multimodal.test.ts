/**
 * Multimodal Image Input Tests
 * Tests for the MultimodalInput module that handles image encoding,
 * file reading, and conversion to ContentPart format.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { MultimodalInput } from '../../src/providers/multimodal/input.js';
import type { ProviderMessage } from '../../src/providers/types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a small valid PNG image as base64 */
function createTestPngBase64(): string {
  // Minimal 1x1 red PNG (valid PNG header + IHDR + IDAT + IEND)
  const pngBuffer = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de' +
    '0000000c4944415408d763f80f0000000200019d1f31260000000049454e44ae426082',
    'hex',
  );
  return pngBuffer.toString('base64');
}

function createTestJpegBase64(): string {
  // Minimal JPEG marker
  const jpegBuffer = Buffer.from(
    'ffd8ffe000104a46494600010100000100010000ffdb00430028151520161820' +
    '282628303838383c3e4451483838516254545c635e545e63627777777777777777' +
    '77777777777777777777777777777777777777777777777777ffc0000b080001' +
    '000103012200021101031101ffc4001f00000105010101010101000000000000' +
    '000102030405060708090a0bffc400b410000201030302040305050404000001' +
    '7d01020300041105122131410613516107227114328191a1082342b1c11552d1' +
    'f02433627209253443821692a2b2c2d2e2f303132333435363738393a3b3c3d3e' +
    '3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e' +
    '5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e' +
    '7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e' +
    '9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbe' +
    'bfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcddde' +
    'df',
    'hex',
  );
  return jpegBuffer.toString('base64');
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test('MultimodalInput creates instance with default config', () => {
  const input = new MultimodalInput();
  assert.ok(input);
});

test('MultimodalInput creates instance with custom config', () => {
  const input = new MultimodalInput({
    maxImageSize: 5 * 1024 * 1024,
    supportedFormats: ['png', 'jpeg', 'webp'],
    defaultDetail: 'high',
  });
  assert.ok(input);
});

test('MultimodalInput encodes buffer to base64 data URL', () => {
  const input = new MultimodalInput();
  const buffer = Buffer.from('test image data');
  const dataUrl = input.encodeBufferToDataUrl(buffer, 'image/png');
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));
});

test('MultimodalInput encodes different MIME types correctly', () => {
  const input = new MultimodalInput();
  const buffer = Buffer.from('test');

  const pngUrl = input.encodeBufferToDataUrl(buffer, 'image/png');
  assert.ok(pngUrl.startsWith('data:image/png;base64,'));

  const jpegUrl = input.encodeBufferToDataUrl(buffer, 'image/jpeg');
  assert.ok(jpegUrl.startsWith('data:image/jpeg;base64,'));

  const webpUrl = input.encodeBufferToDataUrl(buffer, 'image/webp');
  assert.ok(webpUrl.startsWith('data:image/webp;base64,'));
});

test('MultimodalInput converts data URL to ContentPart', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();
  const dataUrl = `data:image/png;base64,${pngBase64}`;

  const part = input.dataUrlToContentPart(dataUrl);
  assert.equal(part.type, 'image_url');
  assert.ok(part.imageUrl);
  assert.ok(part.imageUrl!.url.startsWith('data:image/png;base64,'));
});

test('MultimodalInput converts HTTP URL to ContentPart', () => {
  const input = new MultimodalInput();
  const httpUrl = 'https://example.com/image.png';

  const part = input.httpUrlToContentPart(httpUrl);
  assert.equal(part.type, 'image_url');
  assert.equal(part.imageUrl?.url, httpUrl);
});

test('MultimodalInput converts HTTP URL with detail level', () => {
  const input = new MultimodalInput();
  const httpUrl = 'https://example.com/image.png';

  const part = input.httpUrlToContentPart(httpUrl, 'high');
  assert.equal(part.type, 'image_url');
  assert.equal(part.imageUrl?.url, httpUrl);
  assert.equal(part.imageUrl?.detail, 'high');
});

test('MultimodalInput creates multimodal message from text + image buffer', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();
  const imageBuffer = Buffer.from(pngBase64, 'base64');

  const message = input.createMultimodalMessage(
    'What is in this image?',
    [{ buffer: imageBuffer, mimeType: 'image/png' }],
  );

  assert.equal(message.role, 'user');
  assert.ok(message.contentParts);
  assert.equal(message.contentParts.length, 2);
  assert.equal(message.contentParts[0].type, 'text');
  assert.equal(message.contentParts[0].text, 'What is in this image?');
  assert.equal(message.contentParts[1].type, 'image_url');
  assert.ok(message.contentParts[1].imageUrl?.url.startsWith('data:image/png;base64,'));
});

test('MultimodalInput creates multimodal message with multiple images', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();
  const jpegBase64 = createTestJpegBase64();

  const message = input.createMultimodalMessage(
    'Compare these images',
    [
      { buffer: Buffer.from(pngBase64, 'base64'), mimeType: 'image/png' },
      { buffer: Buffer.from(jpegBase64, 'base64'), mimeType: 'image/jpeg' },
    ],
  );

  assert.equal(message.contentParts?.length, 3); // 1 text + 2 images
  assert.equal(message.contentParts![0].type, 'text');
  assert.equal(message.contentParts![1].type, 'image_url');
  assert.equal(message.contentParts![2].type, 'image_url');
});

test('MultimodalInput creates multimodal message with only images (no text)', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();

  const message = input.createMultimodalMessage(
    '',
    [{ buffer: Buffer.from(pngBase64, 'base64'), mimeType: 'image/png' }],
  );

  assert.equal(message.contentParts?.length, 1);
  assert.equal(message.contentParts![0].type, 'image_url');
});

test('MultimodalInput creates multimodal message from data URLs', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();
  const dataUrl = `data:image/png;base64,${pngBase64}`;

  const message = input.createMultimodalMessage(
    'Analyze this',
    [{ dataUrl }],
  );

  assert.equal(message.contentParts?.length, 2);
  assert.equal(message.contentParts![0].type, 'text');
  assert.equal(message.contentParts![1].type, 'image_url');
});

test('MultimodalInput creates multimodal message from HTTP URLs', () => {
  const input = new MultimodalInput();

  const message = input.createMultimodalMessage(
    'What is this?',
    [{ httpUrl: 'https://example.com/photo.jpg' }],
  );

  assert.equal(message.contentParts?.length, 2);
  assert.equal(message.contentParts![1].imageUrl?.url, 'https://example.com/photo.jpg');
});

test('MultimodalInput detects image format from buffer (PNG)', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();
  const buffer = Buffer.from(pngBase64, 'base64');

  const format = input.detectFormat(buffer);
  assert.equal(format, 'png');
});

test('MultimodalInput detects image format from buffer (JPEG)', () => {
  const input = new MultimodalInput();
  const jpegBase64 = createTestJpegBase64();
  const buffer = Buffer.from(jpegBase64, 'base64');

  const format = input.detectFormat(buffer);
  assert.equal(format, 'jpeg');
});

test('MultimodalInput detects image format from filename', () => {
  const input = new MultimodalInput();

  assert.equal(input.detectFormatFromFilename('photo.png'), 'png');
  assert.equal(input.detectFormatFromFilename('photo.jpg'), 'jpeg');
  assert.equal(input.detectFormatFromFilename('photo.jpeg'), 'jpeg');
  assert.equal(input.detectFormatFromFilename('photo.webp'), 'webp');
  assert.equal(input.detectFormatFromFilename('photo.gif'), 'gif');
});

test('MultimodalInput validates image size', () => {
  const input = new MultimodalInput({ maxImageSize: 1024 });

  const smallBuffer = Buffer.from('small');
  assert.ok(input.validateSize(smallBuffer));

  const largeBuffer = Buffer.alloc(2048);
  assert.ok(!input.validateSize(largeBuffer));
});

test('MultimodalInput validates supported format', () => {
  const input = new MultimodalInput({ supportedFormats: ['png', 'jpeg'] });

  assert.ok(input.isFormatSupported('png'));
  assert.ok(input.isFormatSupported('jpeg'));
  assert.ok(!input.isFormatSupported('gif'));
  assert.ok(!input.isFormatSupported('bmp'));
});

test('MultimodalInput builds content parts array from mixed sources', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();

  const parts = input.buildContentParts(
    'Describe this image',
    [
      { buffer: Buffer.from(pngBase64, 'base64'), mimeType: 'image/png' },
      { httpUrl: 'https://example.com/other.jpg' },
    ],
  );

  assert.equal(parts.length, 3);
  assert.equal(parts[0].type, 'text');
  assert.equal(parts[1].type, 'image_url');
  assert.equal(parts[2].type, 'image_url');
});

test('MultimodalInput handles empty text gracefully', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();

  const parts = input.buildContentParts('', [
    { buffer: Buffer.from(pngBase64, 'base64'), mimeType: 'image/png' },
  ]);

  assert.equal(parts.length, 1);
  assert.equal(parts[0].type, 'image_url');
});

test('MultimodalInput converts ProviderMessage with contentParts to array format', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();

  const message: ProviderMessage = {
    role: 'user',
    content: 'What is this?',
    contentParts: [
      { type: 'text', text: 'What is this?' },
      { type: 'image_url', imageUrl: { url: `data:image/png;base64,${pngBase64}` } },
    ],
  };

  const hasMultimodal = input.hasMultimodalContent(message);
  assert.ok(hasMultimodal);
});

test('MultimodalInput identifies plain text message as non-multimodal', () => {
  const input = new MultimodalInput();

  const message: ProviderMessage = {
    role: 'user',
    content: 'Hello, how are you?',
  };

  const hasMultimodal = input.hasMultimodalContent(message);
  assert.ok(!hasMultimodal);
});

test('MultimodalInput extracts image URLs from content parts', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();

  const message: ProviderMessage = {
    role: 'user',
    content: 'Analyze',
    contentParts: [
      { type: 'text', text: 'Analyze' },
      { type: 'image_url', imageUrl: { url: `data:image/png;base64,${pngBase64}` } },
      { type: 'image_url', imageUrl: { url: 'https://example.com/img.jpg' } },
    ],
  };

  const urls = input.extractImageUrls(message);
  assert.equal(urls.length, 2);
  assert.ok(urls[0].startsWith('data:image/png;base64,'));
  assert.equal(urls[1], 'https://example.com/img.jpg');
});

test('MultimodalInput counts total image size in message', () => {
  const input = new MultimodalInput();
  const pngBase64 = createTestPngBase64();

  const message: ProviderMessage = {
    role: 'user',
    content: 'Test',
    contentParts: [
      { type: 'text', text: 'Test' },
      { type: 'image_url', imageUrl: { url: `data:image/png;base64,${pngBase64}` } },
    ],
  };

  const totalSize = input.estimateTotalImageSize(message);
  assert.ok(totalSize > 0);
});
