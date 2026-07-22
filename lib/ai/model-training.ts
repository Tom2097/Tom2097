
import { createServiceClient } from '@/lib/supabase/service'
import { logAuthEvent } from '@/lib/auth/audit'
import { trackUsage } from '@/lib/billing/usage-tracking'

// Model types supported
const MODEL_TYPES = [
  'regression',
  'classification',
  'time_series',
  'clustering',
  'neural_network',
  'ensemble'
] as const

export type ModelType = typeof MODEL_TYPES[number]

// Training status types
const TRAINING_STATUSES = [
  'draft',
  'preprocessing',
  'training',
  'evaluating',
  'trained',
  'deployed',
  'failed'
] as const

export type TrainingStatus = typeof TRAINING_STATUSES[number]

// Model interface
export interface AIModel {
  id: string
  organization_id: string
  name: string
  description: string | null
  type: ModelType
  status: TrainingStatus
  training_data: {
    dataset_id: string
    size: number
    features: number
    samples: number
    feature_columns?: string[]
    target_column?: string
  }
  performance_metrics: Record<string, number> | null
  deployment_info: {
    endpoint?: string
    last_deployed?: string
    version?: string
  } | null
  hyperparameters: Record<string, unknown> | null
  created_at: string
  updated_at: string
  created_by: string
  training_logs: string[]
}

// Dataset interface
export interface Dataset {
  id: string
  organization_id: string
  name: string
  description: string | null
  file_path: string
  file_type: string
  size: number
  features: number
  samples: number
  columns: string[]
  created_at: string
  created_by: string
}

// Start model training
export async function startModelTraining(
  organizationId: string,
  userId: string,
  modelId: string
): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    
    // Get the model
    const { data: model, error: modelError } = await supabase
      .from('ai_models')
      .select('*')
      .eq('id', modelId)
      .eq('organization_id', organizationId)
      .single()
    
    if (modelError || !model) {
      console.error('[ModelTraining] Model not found:', modelError)
      return false
    }
    
    // Get the dataset
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', model.training_data.dataset_id)
      .eq('organization_id', organizationId)
      .single()
    
    if (datasetError || !dataset) {
      console.error('[ModelTraining] Dataset not found:', datasetError)
      return false
    }
    
    // Update model status to preprocessing
    const { error: updateError } = await supabase
      .from('ai_models')
      .update({
        status: 'preprocessing',
        training_logs: ['Preprocessing data...'],
        updated_at: new Date().toISOString()
      })
      .eq('id', modelId)
    
    if (updateError) {
      console.error('[ModelTraining] Error updating model status:', updateError)
      return false
    }
    
    // Log audit event
    await logAuthEvent({
      action: 'ai.model_training_started',
      organizationId,
      userId,
      resourceType: 'ai_model',
      resourceId: modelId,
      metadata: {
        modelName: model.name,
        modelType: model.type,
        datasetId: dataset.id
      }
    })
    
    // Track usage
    await trackUsage(organizationId, userId, 'ai_training', 1, {
      modelId,
      modelType: model.type
    })
    
    // Start background training process
    startTrainingProcess(organizationId, userId, modelId, dataset.id)
      .catch(err => console.error('[ModelTraining] Error in training process:', err))
    
    return true
  } catch (err) {
    console.error('[ModelTraining] Unexpected error:', err)
    return false
  }
}

// Background training process
async function startTrainingProcess(
  organizationId: string,
  userId: string,
  modelId: string,
  datasetId: string
) {
  const supabase = await createServiceClient()
  
  try {
    // Update status to training
    await updateTrainingStatus(modelId, 'training', 'Starting model training...')
    
    // Simulate data preprocessing
    await simulateDataPreprocessing(modelId, datasetId)
    
    // Simulate model training
    await simulateModelTraining(modelId, datasetId)
    
    // Simulate model evaluation
    await simulateModelEvaluation(modelId)
    
    // Update status to trained
    await updateTrainingStatus(modelId, 'trained', 'Model training completed successfully')
    
    // Log success
    await logAuthEvent({
      action: 'ai.model_training_completed',
      organizationId,
      userId,
      resourceType: 'ai_model',
      resourceId: modelId,
      metadata: {
        status: 'success'
      }
    })
  } catch (err) {
    console.error('[ModelTraining] Error in training process:', err)
    
    // Update status to failed
    await updateTrainingStatus(modelId, 'failed', `Training failed: ${err instanceof Error ? err.message : String(err)}`)
    
    // Log failure
    await logAuthEvent({
      action: 'ai.model_training_failed',
      organizationId,
      userId,
      resourceType: 'ai_model',
      resourceId: modelId,
      metadata: {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err)
      }
    })
  }
}

// Update training status and logs
async function updateTrainingStatus(
  modelId: string,
  status: TrainingStatus,
  logMessage: string
) {
  const supabase = await createServiceClient()
  
  // Get current logs
  const { data: model, error: modelError } = await supabase
    .from('ai_models')
    .select('training_logs')
    .eq('id', modelId)
    .single()
  
  if (modelError) {
    console.error('[ModelTraining] Error fetching model logs:', modelError)
    throw modelError
  }
  
  const updatedLogs = [...(model.training_logs || []), logMessage]
  
  // Update model status and logs
  const { error: updateError } = await supabase
    .from('ai_models')
    .update({
      status,
      training_logs: updatedLogs,
      updated_at: new Date().toISOString()
    })
    .eq('id', modelId)
  
  if (updateError) {
    console.error('[ModelTraining] Error updating model status:', updateError)
    throw updateError
  }
}

// Simulate data preprocessing
async function simulateDataPreprocessing(modelId: string, datasetId: string) {
  const supabase = await createServiceClient()
  
  // Update logs
  await updateTrainingStatus(modelId, 'preprocessing', 'Loading dataset...')
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  await updateTrainingStatus(modelId, 'preprocessing', 'Cleaning data...')
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  await updateTrainingStatus(modelId, 'preprocessing', 'Handling missing values...')
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  await updateTrainingStatus(modelId, 'preprocessing', 'Encoding categorical features...')
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  await updateTrainingStatus(modelId, 'preprocessing', 'Splitting into train/test sets...')
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  await updateTrainingStatus(modelId, 'preprocessing', 'Data preprocessing completed')
}

// Simulate model training
//
// JUDGMENT CALL (see also simulateModelEvaluation below): this codebase has
// no real ML training compute, no feature/label extraction from the
// `datasets` table (which only stores file metadata, not row data), and no
// gradient/loss computation of any kind. The previous code faked per-epoch
// "Loss: 0.xxxx" values with Math.random() and logged them as if a real
// model were being fit. That is exactly the fabrication this fix is meant to
// remove: a human reading those logs would reasonably believe real training
// was happening. We keep the status-machine progression (draft ->
// preprocessing -> training -> evaluating -> trained) because that reflects
// a real, honest state transition of the *record*, but the step logs below
// no longer assert any invented numeric training signal.
async function simulateModelTraining(modelId: string, datasetId: string) {
  const supabase = await createServiceClient()

  // Get model type to determine training approach
  const { data: model, error: modelError } = await supabase
    .from('ai_models')
    .select('type')
    .eq('id', modelId)
    .single()

  if (modelError) throw modelError

  const modelType = model.type

  await updateTrainingStatus(modelId, 'training', `Initializing ${modelType} model...`)
  await new Promise(resolve => setTimeout(resolve, 1000))

  await updateTrainingStatus(
    modelId,
    'training',
    'No real training compute is configured in this environment -- recording this run without fabricated per-epoch metrics.'
  )
  await new Promise(resolve => setTimeout(resolve, 500))

  await updateTrainingStatus(modelId, 'training', 'Model training step completed')
}

// Simulate model evaluation
//
// JUDGMENT CALL: option (b) from the fix brief applies here -- there is no
// real training/evaluation pipeline or held-out dataset in this codebase to
// compute genuine performance metrics (rmse/accuracy/f1/etc. all used to be
// Math.random() dressed up as real numbers). Rather than keep returning
// fabricated metrics under any name, performance_metrics is left null and we
// record an honest, UI-visible note that automated evaluation is not yet
// available. components/digit/predictive-modeling.tsx already only renders
// the "Performance Metrics" section when performance_metrics is truthy, so
// leaving it null means the UI honestly shows nothing there instead of fake
// numbers.
async function simulateModelEvaluation(modelId: string) {
  const supabase = await createServiceClient()

  await updateTrainingStatus(modelId, 'evaluating', 'Evaluating model performance...')
  await new Promise(resolve => setTimeout(resolve, 1000))

  await updateTrainingStatus(
    modelId,
    'evaluating',
    'Automated performance evaluation is not available: this environment has no configured training/evaluation pipeline or held-out dataset. Metrics were intentionally left unset rather than showing fabricated numbers.'
  )

  // Update model explicitly with no performance metrics (honest null, not a
  // fabricated number) so any UI checking `model.performance_metrics` knows
  // there is nothing real to show.
  const { error: updateError } = await supabase
    .from('ai_models')
    .update({
      performance_metrics: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', modelId)

  if (updateError) throw updateError

  await updateTrainingStatus(modelId, 'evaluating', 'Model evaluation step completed')
}

// Deploy a trained model
export async function deployModel(
  organizationId: string,
  userId: string,
  modelId: string
): Promise<{ success: boolean; endpoint?: string }> {
  try {
    const supabase = await createServiceClient()
    
    // Get the model
    const { data: model, error: modelError } = await supabase
      .from('ai_models')
      .select('*')
      .eq('id', modelId)
      .eq('organization_id', organizationId)
      .single()
    
    if (modelError || !model) {
      console.error('[ModelDeployment] Model not found:', modelError)
      return { success: false }
    }
    
    // Check if model is trained
    if (model.status !== 'trained') {
      console.error('[ModelDeployment] Model is not trained:', model.status)
      return { success: false }
    }
    
    // Generate deployment endpoint
    const endpoint = `/api/v1/intelligence/models/${modelId}/predict`
    
    // Update model status to deployed
    const { error: updateError } = await supabase
      .from('ai_models')
      .update({
        status: 'deployed',
        deployment_info: {
          endpoint,
          last_deployed: new Date().toISOString(),
          version: '1.0.0'
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', modelId)
    
    if (updateError) {
      console.error('[ModelDeployment] Error updating model status:', updateError)
      return { success: false }
    }
    
    // Log audit event
    await logAuthEvent({
      action: 'ai.model_deployed',
      organizationId,
      userId,
      resourceType: 'ai_model',
      resourceId: modelId,
      metadata: {
        modelName: model.name,
        endpoint
      }
    })
    
    // Track usage
    await trackUsage(organizationId, userId, 'ai_deployment', 1, {
      modelId,
      modelType: model.type
    })
    
    return { success: true, endpoint }
  } catch (err) {
    console.error('[ModelDeployment] Unexpected error:', err)
    return { success: false }
  }
}

// Make a prediction with a deployed model
export async function makePrediction(
  organizationId: string,
  userId: string,
  modelId: string,
  inputData: Record<string, unknown>
): Promise<{ success: boolean; prediction?: unknown; error?: string }> {
  try {
    const supabase = await createServiceClient()
    
    // Get the model
    const { data: model, error: modelError } = await supabase
      .from('ai_models')
      .select('*')
      .eq('id', modelId)
      .eq('organization_id', organizationId)
      .single()
    
    if (modelError || !model) {
      console.error('[ModelPrediction] Model not found:', modelError)
      return { success: false, error: 'Model not found' }
    }
    
    // Check if model is deployed
    if (model.status !== 'deployed') {
      console.error('[ModelPrediction] Model is not deployed:', model.status)
      return { success: false, error: 'Model is not deployed' }
    }
    
    // Validate input data
    if (!model.training_data.feature_columns) {
      return { success: false, error: 'Model feature columns not defined' }
    }
    
    // Check if all required features are present
    const missingFeatures = model.training_data.feature_columns.filter(
      (col: string) => inputData[col] === undefined
    )
    
    if (missingFeatures.length > 0) {
      return {
        success: false,
        error: `Missing required features: ${missingFeatures.join(', ')}`
      }
    }

    // JUDGMENT CALL (option (b) from the fix brief): there is no real
    // model-serving/inference backend in this codebase -- "deployed" models
    // have no actual fitted weights, only a status flag and a metadata blob.
    // The previous implementation returned a Math.random()-based number,
    // class label, or forecast as if it were a genuine model prediction.
    // Rather than keep fabricating a plausible-looking output, we honestly
    // report that real inference isn't available yet, while still logging
    // the (failed) attempt for audit purposes. See simulateModelEvaluation
    // above for the matching decision on training metrics.
    // Reuses the existing 'ai.model_prediction' audit action (adding a new
    // action literal would mean editing lib/auth/audit.ts's AuthAuditAction
    // union, which is outside this fix's file scope) -- `available: false`
    // in the metadata distinguishes this from a real served prediction.
    await logAuthEvent({
      action: 'ai.model_prediction',
      organizationId,
      userId,
      resourceType: 'ai_model',
      resourceId: modelId,
      metadata: {
        modelName: model.name,
        inputFeatures: Object.keys(inputData),
        available: false
      }
    })

    return {
      success: false,
      error: 'Prediction is not available: this environment has no configured model-serving/inference backend. Training and deployment status are tracked for real, but no actual inference is run.'
    }
  } catch (err) {
    console.error('[ModelPrediction] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Prediction failed'
    }
  }
}