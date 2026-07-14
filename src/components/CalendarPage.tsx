import { CalendarClock, Clock3, Sparkles } from 'lucide-react';
import type { Campaign } from '../types';
import { PlatformMark } from './PlatformMark';

interface CalendarPageProps {
  campaigns: Campaign[];
  onCreate: () => void;
}

export function CalendarPage({ campaigns, onCreate }: CalendarPageProps) {
  const scheduled = campaigns
    .filter((campaign) => campaign.status === 'scheduled' && campaign.scheduledFor)
    .sort(
      (a, b) =>
        new Date(a.scheduledFor ?? 0).getTime() - new Date(b.scheduledFor ?? 0).getTime(),
    );

  const grouped = scheduled.reduce<Record<string, Campaign[]>>((groups, campaign) => {
    const key = new Date(campaign.scheduledFor ?? '').toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    groups[key] = [...(groups[key] ?? []), campaign];
    return groups;
  }, {});

  return (
    <div className="page-stack">
      <section className="hero-panel compact-hero">
        <div>
          <span className="hero-kicker">Publishing calendar</span>
          <h2>See every campaign before it goes live.</h2>
          <p>Schedule a generated platform set once and keep the whole campaign together.</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          <Sparkles size={17} /> Create campaign
        </button>
      </section>

      <section className="panel calendar-panel">
        {scheduled.length === 0 ? (
          <div className="empty-state large-empty">
            <CalendarClock size={30} />
            <strong>No scheduled campaigns</strong>
            <span>Generate a campaign, choose a date and click Schedule.</span>
            <button className="button primary small-button" onClick={onCreate}>Create one</button>
          </div>
        ) : (
          <div className="calendar-agenda">
            {Object.entries(grouped).map(([date, dateCampaigns]) => (
              <section key={date}>
                <div className="agenda-date"><CalendarClock size={17} /><strong>{date}</strong></div>
                <div className="agenda-items">
                  {dateCampaigns.map((campaign) => (
                    <article key={campaign.id}>
                      <span className="agenda-time">
                        <Clock3 size={14} />
                        {new Date(campaign.scheduledFor ?? '').toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="agenda-copy">
                        <strong>{campaign.title}</strong>
                        <small>{campaign.masterText}</small>
                      </span>
                      <span className="platform-stack">
                        {campaign.selectedPlatforms.map((platform) => (
                          <PlatformMark key={platform} platform={platform} size="sm" />
                        ))}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
