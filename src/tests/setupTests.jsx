import '@testing-library/jest-dom';
import { vi } from 'vitest';
import axios from 'axios';
import React from 'react';
global.React = React;

// 1. Mock axios global
vi.mock('axios');

// 2. Mock Global Fetch
global.fetch = vi.fn();

// 3. Mock LocalStorage (Versi "Smart" - Bisa simpan data)
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Terapkan mock ke window object
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});