import { describe, expect, it } from 'vitest';
import { accountFromUrl } from './prefillAccount';

describe('the ?account= deep link from the web portal', () => {
  it('takes a plain login name', () => {
    expect(accountFromUrl('?account=test0')).toBe('test0');
  });

  it('ignores a missing or empty value', () => {
    expect(accountFromUrl('')).toBeNull();
    expect(accountFromUrl('?direct=true')).toBeNull();
    expect(accountFromUrl('?account=')).toBeNull();
  });

  it('ignores names the server could never hold', () => {
    expect(accountFromUrl('?account=ab')).toBeNull();
    expect(accountFromUrl('?account=abcdefghijk')).toBeNull();
    expect(accountFromUrl('?account=test-0')).toBeNull();
    expect(accountFromUrl('?account=test%200')).toBeNull();
    expect(accountFromUrl('?account=%3Cscript%3E')).toBeNull();
  });

  it('takes the bounds, 3 and 10 characters', () => {
    expect(accountFromUrl('?account=abc')).toBe('abc');
    expect(accountFromUrl('?account=abcdefghij')).toBe('abcdefghij');
  });

  it('takes the first account when several are given', () => {
    expect(accountFromUrl('?account=test0&account=test1')).toBe('test0');
  });
});
