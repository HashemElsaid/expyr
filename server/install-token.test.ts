import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/*
 * The secret has to exist before the module is imported: `canIssueTokens` is
 * decided once, at load, and a suite that ran without it would pass by testing
 * a service that had quietly turned itself off.
 */
process.env.EXPYR_INSTALL_SECRET = 'test-secret-long-enough-to-count';

const { canIssueTokens, issueInstallToken, verifyInstallToken } = await import('./install-token.ts');

/**
 * This is the only thing standing between a leaked bundle token and everybody's
 * quota, and it is stateless — there is no list of issued tokens to fall back
 * on, so the signature is the whole of the security. Worth testing properly.
 */

const DAY = 24 * 60 * 60 * 1000;

describe('install tokens', () => {
  it('is switched on when a long enough secret is configured', () => {
    assert.equal(canIssueTokens, true);
  });

  it('accepts a token it issued a moment ago', () => {
    const install = verifyInstallToken(issueInstallToken());
    assert.ok(install);
    assert.equal(typeof install.id, 'string');
  });

  it('gives every install a different id', () => {
    const a = verifyInstallToken(issueInstallToken());
    const b = verifyInstallToken(issueInstallToken());
    assert.notEqual(a?.id, b?.id);
  });

  it('rejects a token whose payload has been edited', () => {
    const [id, issued, signature] = issueInstallToken().split('.');
    // Same signature, different install — the forgery that would let one phone
    // spend another's allowance.
    assert.equal(verifyInstallToken(`${id}x.${issued}.${signature}`), null);
  });

  it('rejects a signature from a different secret', () => {
    const token = issueInstallToken();
    const [id, issued] = token.split('.');
    assert.equal(verifyInstallToken(`${id}.${issued}.notasignature`), null);
  });

  it('rejects tokens older than six months', () => {
    const issued = issueInstallToken(Date.now() - 181 * DAY);
    assert.equal(verifyInstallToken(issued), null);
  });

  it('still accepts one issued just inside six months', () => {
    const issued = issueInstallToken(Date.now() - 179 * DAY);
    assert.ok(verifyInstallToken(issued));
  });

  /*
   * A token stamped in the future is either a clock problem or somebody trying
   * to mint one that never ages out. Neither should be honoured, but a minute
   * of drift between two servers is ordinary and is allowed for.
   */
  it('rejects a token stamped in the future', () => {
    const issued = issueInstallToken(Date.now() + 10 * 60 * 1000);
    assert.equal(verifyInstallToken(issued), null);
  });

  it('tolerates a minute of clock drift', () => {
    const issued = issueInstallToken(Date.now() + 30_000);
    assert.ok(verifyInstallToken(issued));
  });

  it('rejects anything that is not a token at all', () => {
    for (const value of [null, undefined, 42, {}, '', 'a.b', 'a.b.c.d']) {
      assert.equal(verifyInstallToken(value), null);
    }
  });
});
