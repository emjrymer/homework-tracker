/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'student' | 'parent';
    } | null;
  }
}
