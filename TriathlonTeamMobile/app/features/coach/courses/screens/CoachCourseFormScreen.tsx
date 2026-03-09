import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../../../config/theme';
import { LoadingState } from '../../../../components/coach';
import { getCoachCourse, updateCoachCourse, type CoachCourseDetailDto, type CoachCourseUpdateRequest } from '../../../../api/coachCoursesApi';
import type { CoachCoursesStackParamList } from '../../../../navigation/CoachCoursesStackNavigator';

type RouteParams = RouteProp<CoachCoursesStackParamList, 'CoachCourseForm'>;
type NavProp = NativeStackNavigationProp<CoachCoursesStackParamList, 'CoachCourseForm'>;

// Sport options
const SPORTS = [
  { label: 'Înot', value: 'Înot' },
  { label: 'Alergare', value: 'Alergare' },
  { label: 'Ciclism', value: 'Ciclism' },
  { label: 'Triatlon', value: 'Triatlon' },
];

// Level options
const LEVELS = [
  { label: 'Începător', value: 'Începător' },
  { label: 'Intermediar', value: 'Intermediar' },
  { label: 'Avansat', value: 'Avansat' },
];

interface FormData {
  name: string;
  description: string;
  active: boolean;
}

const CoachCourseFormScreen: React.FC = () => {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavProp>();
  const { mode, courseId } = route.params;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courseDetail, setCourseDetail] = useState<CoachCourseDetailDto | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    active: true,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    if (mode === 'edit' && courseId) {
      loadCourse();
    }
  }, [mode, courseId]);

  const loadCourse = async () => {
    if (!courseId) {
      return;
    }

    setLoading(true);
    try {
      const course = await getCoachCourse(courseId);
      setCourseDetail(course);
      setFormData({
        name: course.name,
        description: course.description ?? '',
        active: course.active,
      });
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-au putut încărca detaliile cursului');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Numele cursului este obligatoriu';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Numele trebuie să aibă cel puțin 3 caractere';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Descrierea poate avea maxim 500 caractere';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    if (mode === 'create') {
      Alert.alert(
        'Nu este disponibil',
        'Crearea de cursuri noi din aplicația mobilă nu este încă disponibilă. Te rog folosește interfața web pentru a crea cursuri.',
      );
      return;
    }

    if (!courseId || !courseDetail) {
      Alert.alert('Eroare', 'Detaliile cursului nu sunt disponibile pentru actualizare.');
      return;
    }

    if (!courseDetail.recurrenceRule) {
      Alert.alert(
        'Limitare',
        'Acest curs nu poate fi editat din aplicația mobilă deoarece îi lipsește configurația de program (recurrenceRule). Te rog folosește interfața web.',
      );
      return;
    }

    setSaving(true);
    try {
      const payload: CoachCourseUpdateRequest = {
        name: formData.name.trim(),
        sport: courseDetail.sport,
        level: courseDetail.level,
        ageFrom: courseDetail.ageFrom,
        ageTo: courseDetail.ageTo,
        coachId: courseDetail.coachId,
        locationId: courseDetail.locationId,
        capacity: courseDetail.capacity,
        price: courseDetail.price,
        pricePerSession: courseDetail.pricePerSession,
        packageOptions: courseDetail.packageOptions,
        recurrenceRule: courseDetail.recurrenceRule,
        active: formData.active,
        description: formData.description || null,
      };

      await updateCoachCourse(courseId, payload);
      Alert.alert('Succes', 'Cursul a fost actualizat cu succes');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Eroare', 'Nu s-a putut salva cursul. Încearcă din nou.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Se încarcă cursul..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Name Field */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Nume Curs <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="ex: Înotători Avansați"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          <Text style={styles.charCount}>{formData.name.length}/100</Text>
        </View>

        {/* Description Field */}
        <View style={styles.field}>
          <Text style={styles.label}>Descriere</Text>
          <TextInput
            style={[styles.textArea, errors.description && styles.inputError]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="Descriere cursului..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
          <Text style={styles.charCount}>{formData.description.length}/500</Text>
        </View>

        {/* Sport & Level (read-only for now, to avoid breaking backend expectations) */}
        {courseDetail && (
          <View style={styles.field}>
            <Text style={styles.label}>Sport &amp; Nivel</Text>
            <Text style={styles.readonlyValue}>
              {courseDetail.sport}
              {courseDetail.level ? ` • ${courseDetail.level}` : ''}
            </Text>
          </View>
        )}

        {/* Active Toggle */}
        <View style={styles.field}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.toggleSubtext}>
                {formData.active ? 'Cursul este activ' : 'Cursul este inactiv'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, formData.active && styles.toggleActive]}
              onPress={() => setFormData({ ...formData, active: !formData.active })}
            >
              <View style={[styles.toggleThumb, formData.active && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Anulează</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Text style={styles.saveButtonText}>Se salvează...</Text>
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.surface} />
              <Text style={styles.saveButtonText}>Salvează</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 100,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  required: {
    color: colors.error,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  textArea: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  readonlyValue: {
    ...typography.body,
    color: colors.textSecondary,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
  charCount: {
    ...typography.captionSmall,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionButtonText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
  },
  optionButtonTextSelected: {
    color: colors.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleSubtext: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  toggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundDark,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: colors.success,
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.screenPadding,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.text,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.surface,
  },
});

export default CoachCourseFormScreen;
