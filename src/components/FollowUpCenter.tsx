import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Mail,
  MessageCircle,
  Plus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { contactEncounters, prepareContactRecord } from '../lib/contactHistory';
import {
  followUpDateLabel,
  followUpEmailUrl,
  followUpFromNow,
  followUpIsoFromLocal,
  followUpLocalInput,
  followUpWhatsappUrl,
  pendingFollowUps,
} from '../lib/followUps';
import type { ContactEncounter, MentionEntity } from '../types';
import { ProfileAvatar } from './ProfileAvatar';

interface FollowUpCenterProps {
  entities: MentionEntity[];
  onUpdate: (entity: MentionEntity) => void;
}

function encounterId() {
  return `encounter_${crypto.randomUUID?.() ?? Date.now()}`;
}

function tomorrowAtTen() {
  return followUpLocalInput(followUpFromNow(1));
}

export function FollowUpCenter({ entities, onUpdate }: FollowUpCenterProps) {
  const [selectedId, setSelectedId] = useState(() => entities[0]?.id || '');
  const [nextStep, setNextStep] = useState('');
  const [dueLocal, setDueLocal] = useState(tomorrowAtTen);
  const [status, setStatus] = useState('');

  const followUps = useMemo(() => pendingFollowUps(entities), [entities]);
  const urgentCount = followUps.filter((item) => item.state === 'overdue' || item.state === 'today').length;
  const selected = entities.find((entity) => entity.id === selectedId) || entities[0];

  function saveEncounters(entity: MentionEntity, encounters: ContactEncounter[]) {
    onUpdate(prepareContactRecord({
      ...entity,
      encounters,
      metAt: encounters[0]?.metAt,
      metOn: encounters[0]?.metOn,
      notes: encounters[0]?.notes,
      sourceCardMode: encounters[0]?.sourceCardMode,
    }));
  }

  function scheduleFollowUp() {
    if (!selected) return;
    const followUpAt = followUpIsoFromLocal(dueLocal);
    if (!followUpAt) {
      setStatus('Choose a follow-up date and time.');
      return;
    }
    const history = contactEncounters(selected);
    const latest = history[0] || {
      id: encounterId(),
      metOn: new Date().toISOString(),
      sourceCardMode: 'custom' as const,
    };
    const updatedLatest: ContactEncounter = {
      ...latest,
      followUpAt,
      followUpNote: nextStep.trim() || undefined,
      followUpCompletedAt: undefined,
    };
    saveEncounters(selected, history.length ? [updatedLatest, ...history.slice(1)] : [updatedLatest]);
    setStatus(`Follow-up scheduled with ${selected.displayName}.`);
    setNextStep('');
    setDueLocal(tomorrowAtTen());
  }

  function markDone(entity: MentionEntity, target: ContactEncounter) {
    const encounters = contactEncounters(entity).map((encounter) =>
      encounter.id === target.id
        ? { ...encounter, followUpCompletedAt: new Date().toISOString() }
        : encounter,
    );
    saveEncounters(entity, encounters);
    setStatus(`Follow-up with ${entity.displayName} completed.`);
  }

  function setQuickDate(days: number) {
    setDueLocal(followUpLocalInput(followUpFromNow(days)));
  }

  return (
    <section className="panel follow-up-center">
      <div className="follow-up-center-heading">
        <span className="follow-up-center-icon"><BellRing size={21} /></span>
        <div>
          <span className="eyebrow">Relationship momentum</span>
          <h3>Follow-up queue</h3>
          <p>Turn a good encounter into a next conversation while the context is still warm.</p>
        </div>
        <span className={`follow-up-count-pill${urgentCount ? ' urgent' : ''}`}>
          {urgentCount ? `${urgentCount} due now` : `${followUps.length} scheduled`}
        </span>
      </div>

      {followUps.length > 0 && (
        <div className="follow-up-list">
          {followUps.slice(0, 6).map(({ entity, encounter, state }) => {
            const emailUrl = followUpEmailUrl(entity, encounter);
            const whatsappUrl = followUpWhatsappUrl(entity, encounter);
            return (
              <article className={`follow-up-item state-${state}`} key={`${entity.id}:${encounter.id}`}>
                <ProfileAvatar name={entity.displayName} src={entity.avatarUrl} className="follow-up-avatar" />
                <div className="follow-up-item-copy">
                  <strong>{entity.displayName}</strong>
                  <span>{encounter.followUpNote || 'Follow up on your conversation'}</span>
                  <small><CalendarClock size={13} /> {followUpDateLabel(encounter.followUpAt)}</small>
                </div>
                <div className="follow-up-item-actions">
                  {emailUrl && <a href={emailUrl} aria-label={`Email ${entity.displayName}`}><Mail size={16} /><span>Email</span></a>}
                  {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${entity.displayName}`}><MessageCircle size={16} /><span>WhatsApp</span></a>}
                  <button type="button" onClick={() => markDone(entity, encounter)}><CheckCircle2 size={16} /><span>Done</span></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="follow-up-scheduler">
        <div className="follow-up-scheduler-heading">
          <Plus size={17} />
          <span><strong>Schedule a follow-up</strong><small>Attached to this person’s most recent encounter.</small></span>
        </div>
        {entities.length ? (
          <div className="follow-up-scheduler-fields">
            <label className="field">
              <span>Person</span>
              <select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)}>
                {entities.map((entity) => <option value={entity.id} key={entity.id}>{entity.displayName}</option>)}
              </select>
            </label>
            <label className="field follow-up-next-step-field">
              <span>Next step</span>
              <input value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="Send the deck, make an introduction, schedule coffee…" />
            </label>
            <label className="field">
              <span>Follow up</span>
              <input type="datetime-local" value={dueLocal} onChange={(event) => setDueLocal(event.target.value)} />
            </label>
            <div className="follow-up-quick-dates" aria-label="Quick follow-up dates">
              <button type="button" onClick={() => setQuickDate(1)}>Tomorrow</button>
              <button type="button" onClick={() => setQuickDate(3)}>In 3 days</button>
              <button type="button" onClick={() => setQuickDate(7)}>Next week</button>
            </div>
            <button className="button primary follow-up-save-button" type="button" onClick={scheduleFollowUp}><BellRing size={16} /> Schedule</button>
          </div>
        ) : (
          <div className="follow-up-empty">Save a contact first, then schedule the next conversation here.</div>
        )}
      </div>

      {status && <div className="follow-up-status" aria-live="polite"><CheckCircle2 size={15} /> {status}</div>}
    </section>
  );
}
