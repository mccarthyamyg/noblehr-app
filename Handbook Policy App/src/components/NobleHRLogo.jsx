import React from 'react';

/**
 * Noble HR Logo — Faceted crystalline N with blue-to-cyan gradient + HR stamp
 * Uses the approved brand asset from the Noble Platform Icon Suite
 */
export function NobleShieldLogo({ className = 'w-10 h-10', ...props }) {
  return (
    <img
      src="/noble-hr-logo.png"
      alt="Noble HR"
      className={`${className} object-contain rounded-2xl shadow-lg`}
      draggable={false}
      {...props}
    />
  );
}

/**
 * Noble HR full wordmark (icon + text) — used on login page
 */
export function NobleHRWordmark({ iconSize = 'w-14 h-14', textSize = 'text-2xl' }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <NobleShieldLogo className={iconSize} />
      <div className="text-center">
        <h1 className={`${textSize} font-bold tracking-tight text-slate-900`}>
          Noble <span className="bg-gradient-to-r from-[#1d4ed8] to-[#06b6d4] bg-clip-text text-transparent">HR</span>
        </h1>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Governance Platform</p>
      </div>
    </div>
  );
}
