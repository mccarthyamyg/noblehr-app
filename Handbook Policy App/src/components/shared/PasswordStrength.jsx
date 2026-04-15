import { Check, X } from 'lucide-react';

/**
 * Password strength rules — shared across Setup, InviteAccept, ResetPassword.
 * Returns { rules, allPassed, score }.
 */
export function evaluatePassword(password) {
  const rules = [
    { key: 'length', label: 'At least 8 characters', passed: password.length >= 8 },
    { key: 'uppercase', label: 'One uppercase letter', passed: /[A-Z]/.test(password) },
    { key: 'lowercase', label: 'One lowercase letter', passed: /[a-z]/.test(password) },
    { key: 'number', label: 'One number', passed: /[0-9]/.test(password) },
    { key: 'special', label: 'One special character (!@#$%^&*)', passed: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ];
  const passed = rules.filter(r => r.passed).length;
  return { rules, allPassed: passed === rules.length, score: passed };
}

/**
 * Password strength indicator component.
 * Shows a visual checklist of rules and a strength bar.
 */
export function PasswordStrength({ password }) {
  if (!password) return null;

  const { rules, score } = evaluatePassword(password);
  const percent = (score / rules.length) * 100;

  const barColor =
    percent <= 40 ? 'bg-red-500' :
    percent <= 60 ? 'bg-amber-500' :
    percent <= 80 ? 'bg-yellow-400' :
    'bg-emerald-500';

  const strengthLabel =
    percent <= 40 ? 'Weak' :
    percent <= 60 ? 'Fair' :
    percent <= 80 ? 'Good' :
    'Strong';

  return (
    <div className="space-y-2 mt-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${
          percent <= 40 ? 'text-red-600' :
          percent <= 60 ? 'text-amber-600' :
          percent <= 80 ? 'text-yellow-600' :
          'text-emerald-600'
        }`}>
          {strengthLabel}
        </span>
      </div>

      {/* Rule checklist */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {rules.map(rule => (
          <div key={rule.key} className="flex items-center gap-1.5">
            {rule.passed ? (
              <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            ) : (
              <X className="w-3 h-3 text-slate-300 flex-shrink-0" />
            )}
            <span className={`text-[11px] ${rule.passed ? 'text-emerald-700' : 'text-slate-400'}`}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PasswordStrength;
