declare module 'glob' {
  interface GlobOptions {
    cwd?: string;
    ignore?: string | string[];
    absolute?: boolean;
    nodir?: boolean;
  }

  function glob(pattern: string | string[], options: GlobOptions): Promise<string[]>;

  export = glob;
}
