import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PDFDocument } from 'pdf-lib';

import { pdfPageCount, pdfPages } from './pdf.ts';

/**
 * Built here rather than committed as a fixture: a binary in the repo tells you
 * nothing about why it has five pages, and this way the test says it.
 */
async function makePdf(pages: number): Promise<string> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage([200, 200]);
  return doc.saveAsBase64();
}

test('counts the pages it was given', async () => {
  assert.equal(await pdfPageCount(await makePdf(1)), 1);
  assert.equal(await pdfPageCount(await makePdf(14)), 14);
});

test('cuts an inclusive range, counted from one', async () => {
  const source = await makePdf(14);
  assert.equal(await pdfPageCount(await pdfPages(source, 1, 4)), 4);
  assert.equal(await pdfPageCount(await pdfPages(source, 5, 8)), 4);
  assert.equal(await pdfPageCount(await pdfPages(source, 7, 7)), 1);
});

/*
 * The phone divides a page count into fixed batches, so the final batch asks
 * for pages that are not there almost every time. 14 pages in fours ends with
 * a request for 13 to 16.
 */
test('clamps a range running past the end rather than failing', async () => {
  const source = await makePdf(14);
  assert.equal(await pdfPageCount(await pdfPages(source, 13, 16)), 2);
  assert.equal(await pdfPageCount(await pdfPages(source, 14, 99)), 1);
});

test('clamps a range starting before the first page', async () => {
  const source = await makePdf(3);
  assert.equal(await pdfPageCount(await pdfPages(source, 0, 2)), 2);
});

test('a range entirely past the end still yields a readable page', async () => {
  // Better one wrong page than a request that throws on the last batch.
  const source = await makePdf(3);
  assert.equal(await pdfPageCount(await pdfPages(source, 90, 99)), 1);
});

test('every page survives being cut into batches', async () => {
  const source = await makePdf(14);
  let total = 0;
  for (let from = 1; from <= 14; from += 4) {
    total += await pdfPageCount(await pdfPages(source, from, from + 3));
  }
  assert.equal(total, 14);
});
