import { describe, expect, it } from 'vitest';
import { avatarFor } from '../src/lib/workerAvatars.js';

describe('avatarFor', () => {
  it('finds the portrait by first name, ignoring case and the rest of the name', () => {
    expect(avatarFor('Amina El Idrissi').src).toEqual(expect.stringContaining('amina'));
    expect(avatarFor('YOUSSEF Benali').src).toEqual(expect.stringContaining('youssef'));
    expect(avatarFor('salma').src).toEqual(expect.stringContaining('salma'));
  });

  it('gives each portrait its own gradient, except Youssef who shares the neutral one', () => {
    expect(avatarFor('Amina').gradient).not.toBe(avatarFor('Salma').gradient);
    expect(avatarFor('Youssef').gradient).toBe(avatarFor('Someone Else').gradient);
  });

  it('falls back to initials (no portrait) for a worker without one', () => {
    expect(avatarFor('Karim Tazi').src).toBeNull();
  });
});
