const panelStyles = `
  :host { all: initial; }
  .japc-panel {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 360px;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    background: #ffffff;
    border: 1px solid #e2e2e2;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: #1a1a1a;
    z-index: 2147483647;
  }
  .japc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    font-weight: 600;
  }
  .japc-close {
    cursor: pointer;
    border: none;
    background: none;
    font-size: 16px;
    color: #888;
  }
  .japc-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
  .japc-field { display: flex; flex-direction: column; gap: 4px; }
  .japc-label { font-weight: 500; }
  .japc-badge {
    display: inline-block;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 999px;
    margin-left: 6px;
    font-weight: 600;
  }
  .japc-badge.ok { background: #e3f6e8; color: #1a7f37; }
  .japc-badge.missing-required { background: #fde8e8; color: #c81e1e; }
  .japc-badge.missing-optional { background: #fff4de; color: #9a6700; }
  .japc-input {
    padding: 6px 8px;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
  }
  .japc-input.missing-required { border-color: #c81e1e; }
  .japc-hint { color: #888; font-size: 11px; }
  .japc-checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #555; }
  .japc-footer { padding: 12px 16px; border-top: 1px solid #eee; display: flex; flex-direction: column; gap: 8px; }
  .japc-button {
    padding: 8px 12px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .japc-button.primary { background: #1a1a1a; color: #fff; }
  .japc-button.primary:disabled { background: #ccc; cursor: not-allowed; }
  .japc-button.secondary { background: #f2f2f2; color: #1a1a1a; }
  .japc-note { font-size: 11px; color: #888; text-align: center; }
  .japc-debug { display: flex; flex-direction: column; gap: 6px; align-items: center; }
  .japc-debug-log {
    width: 100%;
    max-height: 160px;
    overflow-y: auto;
    font-family: monospace;
    font-size: 10px;
    background: #fafafa;
    padding: 8px;
    border-radius: 8px;
    white-space: pre-wrap;
    box-sizing: border-box;
  }
  .japc-launcher {
    position: fixed;
    bottom: 16px;
    right: 16px;
    background: #1a1a1a;
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 10px 16px;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 2147483647;
  }
`

export default panelStyles
