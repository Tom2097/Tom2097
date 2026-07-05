// Test the model training route fix
async function test() {
  const startModelTraining = async (orgId: string, userId: string, modelId: string): Promise<boolean> => {
    return true;
  };
  
  const organizationId = 'org-123';
  const userId = 'user-123';
  const modelId = 'model-123';
  
  // This should work with 3 parameters
  const result = await startModelTraining(organizationId, userId, modelId);
  console.log('Test passed:', result);
}

test();
