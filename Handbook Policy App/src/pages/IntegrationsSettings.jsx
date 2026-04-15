import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, DollarSign, UtensilsCrossed, Plug } from 'lucide-react';

const INTEGRATIONS = [
  {
    name: 'Noble Task',
    subtitle: 'Workforce Operations',
    description: 'Sync employee records, checklists, and task assignments across platforms.',
    icon: ClipboardCheck,
    color: 'from-blue-500 to-cyan-500',
    status: 'coming_soon',
  },
  {
    name: 'Noble Play',
    subtitle: 'Financial Tracking',
    description: 'Connect labor costs and sales data for real-time financial insights.',
    icon: DollarSign,
    color: 'from-amber-500 to-orange-500',
    status: 'coming_soon',
  },
  {
    name: 'Inventory & Recipes',
    subtitle: 'Food Cost Management',
    description: 'Link HR compliance to recipe costing and inventory management workflows.',
    icon: UtensilsCrossed,
    color: 'from-purple-500 to-pink-500',
    status: 'coming_soon',
  },
];

export default function IntegrationsSettings() {
  return (
    <div>
      <PageHeader
        title="Noble Integrations"
        description="Connect your Noble apps together. Coming soon."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {INTEGRATIONS.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card
              key={integration.name}
              className="relative overflow-hidden opacity-60 cursor-not-allowed"
            >
              <CardContent className="pt-6">
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 ${integration.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                {/* Info */}
                <h3 className="font-semibold text-slate-900 mb-0.5">{integration.name}</h3>
                <p className="text-xs text-slate-500 mb-3">{integration.subtitle}</p>
                <p className="text-sm text-slate-600 mb-4">{integration.description}</p>

                {/* Status */}
                <Badge variant="secondary" className="text-[10px]">
                  Coming soon
                </Badge>
              </CardContent>

              {/* Greyed overlay */}
              <div className="absolute inset-0 bg-white/30 pointer-events-none" />
            </Card>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-slate-400">
          <Plug className="w-4 h-4" />
          <span>Integrations will be available in a future update.</span>
        </div>
      </div>
    </div>
  );
}
