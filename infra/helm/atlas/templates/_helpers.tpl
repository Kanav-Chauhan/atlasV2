{{- define "atlas.name" -}}{{ .Release.Name }}{{- end -}}

{{- define "atlas.labels" -}}
app.kubernetes.io/name: atlas
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "atlas.selector" -}}
app.kubernetes.io/name: atlas
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "atlas.secretName" -}}
{{- default (printf "%s-secrets" .Release.Name) .Values.existingSecret -}}
{{- end -}}

{{/* Env shared by api and worker: config map + secrets + database/redis URLs. */}}
{{- define "atlas.appEnv" -}}
envFrom:
  - configMapRef: { name: {{ .Release.Name }}-config }
  - secretRef: { name: {{ include "atlas.secretName" . }} }
env:
  - name: POSTGRES_PASSWORD
    valueFrom: { secretKeyRef: { name: {{ include "atlas.secretName" . }}, key: POSTGRES_PASSWORD } }
  - name: ATLAS_DATABASE_URL
    {{- if .Values.postgres.enabled }}
    value: "postgresql+asyncpg://{{ .Values.postgres.user }}:$(POSTGRES_PASSWORD)@{{ .Release.Name }}-postgres:5432/{{ .Values.postgres.database }}"
    {{- else }}
    value: {{ required "externalDatabaseUrl is required when postgres.enabled=false" .Values.externalDatabaseUrl | quote }}
    {{- end }}
  - name: ATLAS_REDIS_URL
    {{- if .Values.redis.enabled }}
    value: "redis://{{ .Release.Name }}-redis:6379/0"
    {{- else }}
    value: {{ required "externalRedisUrl is required when redis.enabled=false" .Values.externalRedisUrl | quote }}
    {{- end }}
  - { name: ATLAS_FILES_DIR, value: /data/files }
  - { name: ATLAS_MODELS_DIR, value: /models }
{{- end -}}

{{- define "atlas.appVolumes" -}}
- name: files
  persistentVolumeClaim: { claimName: {{ .Release.Name }}-files }
- name: models
  persistentVolumeClaim: { claimName: {{ .Release.Name }}-models }
{{- end -}}

{{- define "atlas.appMounts" -}}
- { name: files, mountPath: /data/files }
- { name: models, mountPath: /models }
{{- end -}}
