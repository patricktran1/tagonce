import { ArrowRight, AtSign, CalendarClock, FileStack, Send, Sparkles } from 'lucide-react';
import type { Campaign, MentionEntity } from '../types';
import { PlatformMark } from './PlatformMark';

interface DashboardPageProps {
  campaigns: Campaign[];
  entities: MentionEntity[];
  onCreate: () => void;
  onOpenCampaigns: () => void;
}

export function DashboardPage({
  campaigns,
  entities,
  onCreate,
  onOpenCampaigns,
}: DashboardPageProps) {
  const platformPosts = campaigns.reduce(
    (total, campaign) => total + campaign.variants.length,
    0,
  );
  const scheduled = campaigns
    .filter((campaign) => campaign.status === 'scheduled' && campaign.scheduledFor)
    .sort(
      (a, b) =>
        new Date(a.scheduledFor ?? 0).getTime() - new Date(b.scheduledFor ?? 0).getTime(),
    );
  const recent = campaigns.slice(0, 4);

  return (
    <div className="page-stack">
      <section className="hero-panel dashboard-hero">
        <div>
          <span className="hero-kicker">TagOnce command center</span>
          <h2>Turn one idea into a complete social campaign.</h2>
          <p>
            Your mentions, platform variants, schedules and publishing status live in one
            operating layer.
          </p>
          <button className="button primary hero-button" onClick={onCreate}>
            <Sparkles size={17} />
            Create campaign
          </button>
        </div>
        <div className="dashboard-signal">
          <span>Next scheduled campaign</span>
          <strong>
            {scheduled[0]?.scheduledFor
              ? new Date(scheduled[0].scheduledFor).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : 'None'}
          </strong>
          <small>{scheduled[0]?.title ?? 'Build and schedule your first campaign'}</small>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span className="metric-icon"><FileStack size={18} /></span>
          <span><small>Campaigns</small><strong>{campaigns.length}</strong></span>
        </article>
        <article className="metric-card">
          <span className="metric-icon"><Send size={18} /></span>
          <span><small>Platform posts</small><strong>{platformPosts}</strong></span>
        </article>
        <article className="metric-card">
          <span className="metric-icon"><AtSign size={18} /></span>
          <span><small>Saved mentions</small><strong>{entities.length}</strong></span>
        </article>
        <article className="metric-card">
          <span className="metric-icon"><CalendarClock size={18} /></span>
          <span><small>Scheduled</small><strong>{scheduled.length}</strong></span>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="panel dashboard-panel">
          <div className="panel-heading simple-heading">
            <div>
              <div>
                <h3>Recent campaigns</h3>
                <p>Your latest master posts and generated channel sets.</p>
              </div>
            </div>
            <button className="text-button" onClick={onOpenCampaigns}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="empty-state slim-empty">
              <Sparkles size={24} />
              <strong>No campaigns yet</strong>
              <span>Your first campaign will appear here.</span>
            </div>
          ) : (
            <div className="dashboard-campaign-list">
              {recent.map((campaign) => (
                <article key={campaign.id}>
                  <span className={`status-dot status-${campaign.status}`} />
                  <span className="dashboard-campaign-copy">
                    <strong>{campaign.title}</strong>
                    <small>{new Date(campaign.createdAt).toLocaleDateString()}</small>
                  </span>
                  <span className="platform-stack compact-stack">
                    {campaign.selectedPlatforms.slice(0, 5).map((platform) => (
                      <PlatformMark key={platform} platform={platform} size="sm" />
                    ))}
                  </span>
                  <span className={`status-pill status-${campaign.status}`}>
                    {campaign.status}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel dashboard-panel">
          <div className="panel-heading simple-heading">
            <div>
              <div>
                <h3>Mention coverage</h3>
                <p>How complete your reusable identity graph is.</p>
              </div>
            </div>
          </div>
          <div className="coverage-list">
            {entities.slice(0, 5).map((entity) => {
              const mapped = Object.keys(entity.mappings).length;
              const percentage = Math.round((mapped / 7) * 100);
              return (
                <div key={entity.id}>
                  <span className="entity-avatar small-avatar">{entity.initials}</span>
                  <span className="coverage-copy">
                    <strong>{entity.displayName}</strong>
                    <span className="coverage-track"><i style={{ width: `${percentage}%` }} /></span>
                  </span>
                  <small>{mapped}/7</small>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
