import { Calendar, Copy, FileText, Search, Send, Trash2 } from 'lucide-react';
import type { Campaign } from '../types';
import { PlatformMark } from './PlatformMark';

interface CampaignsPageProps {
  campaigns: Campaign[];
  onDelete: (campaignId: string) => void;
  onDuplicate: (campaign: Campaign) => void;
}

export function CampaignsPage({ campaigns, onDelete, onDuplicate }: CampaignsPageProps) {
  return (
    <div className="page-stack">
      <section className="hero-panel compact-hero">
        <div>
          <span className="hero-kicker">Campaign history</span>
          <h2>Every master post and its platform variants.</h2>
          <p>
            This local MVP saves campaigns in your browser. The production build will move
            these records into a workspace database.
          </p>
        </div>
        <div className="hero-stat-group">
          <span>
            <strong>{campaigns.length}</strong>
            Campaigns
          </span>
          <span>
            <strong>
              {campaigns.reduce((total, campaign) => total + campaign.variants.length, 0)}
            </strong>
            Platform posts
          </span>
        </div>
      </section>

      <section className="panel directory-panel">
        <div className="directory-toolbar">
          <label className="table-search">
            <Search size={17} />
            <input placeholder="Search campaigns" />
          </label>
          <span className="record-count">Newest first</span>
        </div>

        {campaigns.length === 0 ? (
          <div className="empty-state large-empty">
            <FileText size={28} />
            <strong>No campaigns yet</strong>
            <span>Generate your first platform set, then save or publish it.</span>
          </div>
        ) : (
          <div className="campaign-table-wrap">
            <table className="campaign-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Platforms</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <div className="campaign-name-cell">
                        <span className="campaign-file-icon">
                          {campaign.status === 'published' ? <Send size={17} /> : <FileText size={17} />}
                        </span>
                        <span>
                          <strong>{campaign.title}</strong>
                          <small>{campaign.masterText}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="platform-stack">
                        {campaign.selectedPlatforms.map((platform) => (
                          <PlatformMark key={platform} platform={platform} size="sm" />
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill status-${campaign.status}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td>
                      <span className="date-cell">
                        <Calendar size={14} />
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" aria-label="Duplicate campaign" onClick={() => onDuplicate(campaign)}>
                          <Copy size={16} />
                        </button>
                        <button
                          className="icon-button danger-icon"
                          aria-label="Delete campaign"
                          onClick={() => onDelete(campaign.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
