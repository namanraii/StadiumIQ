/**
 * auth.js
 * @module auth
 * @description Firebase Authentication integration for StadiumIQ.
 * Signs users in anonymously on first visit to create a persistent session,
 * enabling per-user performance traces in Firebase Performance Monitoring
 * and future personalisation (e.g. saved seat preferences, alert history).
 *
 * Anonymous auth is ideal for stadium events — no registration friction,
 * yet each session is uniquely identifiable for analytics and access control.
 *
 * Google Services used:
 *  - Firebase Authentication (firebase.google.com/products/auth) — anonymous sessions
 *
 * @see https://firebase.google.com/docs/auth/web/anonymous-auth
 */
import { getAuth, signInAnonymously, onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { logger } from "./logger.js";

/** @type {import("firebase/auth").Auth|null} Firebase Auth instance */
let _auth = null;

/** @type {string|null} Current anonymous user UID — available after sign-in */
let _uid = null;

/**
 * Initialise Firebase Authentication and sign in anonymously.
 * Sets up an `onAuthStateChanged` listener that keeps `_uid` in sync.
 * Safe to call multiple times — idempotent after first initialisation.
 *
 * @param {import("firebase/app").FirebaseApp} app - Initialised Firebase app instance
 * @returns {Promise<string|null>} Resolves to the anonymous UID, or null on failure
 */
export async function initAuth(app) {
  try {
    _auth = getAuth(app);
    const result = await signInAnonymously(_auth);
    _uid = result.user.uid;
    logger.info("auth", `Anonymous session started: ${_uid.slice(0, 8)}…`);

    // Keep UID updated across token refreshes
    onAuthStateChanged(_auth, user => {
      _uid = user ? user.uid : null;
    });

    return _uid;
  } catch (e) {
    // Non-fatal — app continues without authenticated session
    logger.warn("auth", "Anonymous sign-in unavailable:", e.message);
    return null;
  }
}

/**
 * Returns the current anonymous user UID.
 * Useful for scoping Firebase reads or tagging analytics events.
 *
 * @returns {string|null} UID string or null if not yet authenticated
 */
export function getCurrentUid() {
  return _uid;
}

/**
 * Returns whether the current user is signed in anonymously.
 * @returns {boolean}
 */
export function isAuthenticated() {
  return _uid !== null;
}
