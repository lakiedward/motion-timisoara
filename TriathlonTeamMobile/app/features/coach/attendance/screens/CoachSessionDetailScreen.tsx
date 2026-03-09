import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { colors, radii, shadows, spacing } from '../../../../config/theme';
import {
  getCoachSessionAttendance,
  markCoachSessionAttendance,
  SessionAttendanceDto,
  ChildAttendancePaymentDto,
} from '../../../../api/coachSessionAttendanceApi';
import { purchaseAdditionalSessions } from '../../../../api/enrollmentApi';
import type { CoachSessionsStackParamList } from '../../../../navigation/CoachSessionsStackNavigator';

type SessionRouteProp = RouteProp<CoachSessionsStackParamList, 'CoachSessionDetail'>;

type ChildWithState = ChildAttendancePaymentDto & {
  present: boolean;
};

const CoachSessionDetailScreen: React.FC = () => {
  const route = useRoute<SessionRouteProp>();
  const { occurrenceId } = route.params;

  const [session, setSession] = useState<SessionAttendanceDto | null>(null);
  const [children, setChildren] = useState<ChildWithState[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCoachSessionAttendance(occurrenceId);
      setSession(data);
      const mappedChildren: ChildWithState[] = data.children.map((child) => ({
        ...child,
        present: child.attendanceStatus === 'PRESENT',
      }));
      setChildren(mappedChildren);
    } catch (e) {
      setError('Nu s-au putut încărca detaliile sesiunii. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occurrenceId]);

  const handleAddSessions = async (child: ChildAttendancePaymentDto, count: number) => {
    if (!count || count <= 0) return;
    setSubmittingId(child.enrollmentId);
    setInfoMessage(null);
    try {
      await purchaseAdditionalSessions({
        enrollmentId: child.enrollmentId,
        sessionCount: count,
        paymentMethod: 'CASH',
      });
      setInfoMessage(`S-au adăugat ${count} sesiuni cash pentru ${child.childName}.`);
      await load();
    } catch (e) {
      setError('Nu am putut adăuga sesiunile. Încearcă din nou.');
    } finally {
      setSubmittingId(null);
    }
  };

  const togglePresence = (enrollmentId: string) => {
    setChildren((prev) =>
      prev.map((child) =>
        child.enrollmentId === enrollmentId
          ? {
              ...child,
              present: !child.present,
            }
          : child,
      ),
    );
  };

  const handleSaveAttendance = async () => {
    if (!children.length) return;
    setSaving(true);
    setInfoMessage(null);
    setError(null);
    try {
      const items = children.map((child) => ({
        childId: child.childId,
        status: child.present ? ('PRESENT' as const) : ('ABSENT' as const),
      }));
      await markCoachSessionAttendance(occurrenceId, items);
      setInfoMessage('Prezențele au fost salvate.');
      await load();
    } catch (e) {
      setError('Nu am putut salva prezențele. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !session) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error && !session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Text style={styles.link} onPress={load}>
          Reîncearcă
        </Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Nu s-au găsit detalii pentru această sesiune.</Text>
      </View>
    );
  }

  const start = new Date(session.startsAt);
  const dateLabel = start.toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  const timeLabel = start.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.sessionTitle}>{session.courseName}</Text>
        <Text style={styles.sessionMeta}>
          {dateLabel} · {timeLabel}
        </Text>
        <Text style={styles.sessionMeta}>Copii înscriși: {session.children.length}</Text>
      </View>

      {infoMessage ? <Text style={styles.info}>{infoMessage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Copii & sesiuni</Text>
          <Text style={styles.sectionSubtitle}>
            Marchează prezențele și confirmă încasări cash pentru fiecare copil.
          </Text>
        </View>
        {children.map((child) => {
          const isSubmitting = submittingId === child.enrollmentId;
          return (
            <View key={child.enrollmentId} style={styles.childCard}>
              <View style={styles.childHeaderRow}>
                <Text style={styles.childName}>{child.childName}</Text>
                {child.lowSessionWarning ? (
                  <Text style={styles.badgeWarning}>Puține sesiuni</Text>
                ) : null}
              </View>
              <Text style={styles.childMeta}>
                Rămase: {child.remainingSessions} · Folosite: {child.sessionsUsed}
              </Text>
              <View style={styles.presenceRow}>
                <TouchableOpacity
                  style={[
                    styles.presenceChip,
                    child.present && styles.presenceChipActive,
                    styles.presenceChipPresent,
                  ]}
                  onPress={() => togglePresence(child.enrollmentId)}
                >
                  <Text
                    style={[
                      styles.presenceChipText,
                      child.present && styles.presenceChipTextActive,
                    ]}
                  >
                    {child.present ? 'Prezent' : 'Marchează prezent'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, isSubmitting && styles.actionButtonDisabled]}
                  onPress={() => handleAddSessions(child, 5)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.actionButtonText}>+5 sesiuni cash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, isSubmitting && styles.actionButtonDisabled]}
                  onPress={() => handleAddSessions(child, 10)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.actionButtonText}>+10 sesiuni cash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, isSubmitting && styles.actionButtonDisabled]}
                  onPress={() => handleAddSessions(child, 15)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.actionButtonText}>+15 sesiuni cash</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        {children.length > 0 && (
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveAttendance}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Se salvează prezențele...' : 'Salvează prezențele'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 96,
  },
  headerCard: {
    padding: 16,
    borderRadius: radii.card,
    backgroundColor: colors.primary,
    marginBottom: spacing.cardGap,
    ...shadows.card,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#eff6ff',
  },
  sessionMeta: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(239,246,255,0.9)',
  },
  sectionCard: {
    padding: 14,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    marginBottom: spacing.cardGap,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  sectionHeaderRow: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  childCard: {
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  childHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  childName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  childMeta: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
  badgeWarning: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  presenceRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  presenceChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: '#e5e7eb',
  },
  presenceChipPresent: {},
  presenceChipActive: {
    backgroundColor: '#22c55e',
  },
  presenceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  presenceChipTextActive: {
    color: '#ffffff',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: '#eff6ff',
    marginRight: 8,
    marginTop: 6,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  footerRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  empty: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 8,
  },
  info: {
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  link: {
    color: colors.primary,
    marginTop: 4,
  },
});

export default CoachSessionDetailScreen;
