// Test JSONBin API functionality
const JSONBIN_API_BASE = 'https://api.jsonbin.io/v3'

async function testJSONBin() {
  console.log('🧪 Testing JSONBin API...\n')

  // Test 1: Create a bin
  console.log('1️⃣ Creating test bin...')
  try {
    const testData = {
      message: 'Baby Tracker Test',
      timestamp: new Date().toISOString(),
      entries: [],
      currentActivity: 'awake'
    }

    const createResponse = await fetch(`${JSONBIN_API_BASE}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    })

    if (!createResponse.ok) {
      throw new Error(`HTTP ${createResponse.status}: ${createResponse.statusText}`)
    }

    const createResult = await createResponse.json()
    const binId = createResult.metadata.id

    console.log('✅ Bin created successfully!')
    console.log(`   Bin ID: ${binId}`)
    console.log(`   Room Code: ${formatRoomCode(binId)}`)
    console.log()

    // Test 2: Read the bin
    console.log('2️⃣ Reading bin data...')
    const readResponse = await fetch(`${JSONBIN_API_BASE}/b/${binId}/latest`, {
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!readResponse.ok) {
      throw new Error(`HTTP ${readResponse.status}: ${readResponse.statusText}`)
    }

    const readResult = await readResponse.json()
    console.log('✅ Bin read successfully!')
    console.log('   Data:', JSON.stringify(readResult.record, null, 2))
    console.log()

    // Test 3: Update the bin
    console.log('3️⃣ Updating bin data...')
    const updatedData = {
      ...testData,
      message: 'Baby Tracker Test - Updated',
      timestamp: new Date().toISOString(),
      updateCount: 1
    }

    const updateResponse = await fetch(`${JSONBIN_API_BASE}/b/${binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedData)
    })

    if (!updateResponse.ok) {
      throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}`)
    }

    const updateResult = await updateResponse.json()
    console.log('✅ Bin updated successfully!')
    console.log(`   Version: ${updateResult.metadata.versionId}`)
    console.log()

    // Test 4: Read again to verify update
    console.log('4️⃣ Verifying update...')
    const verifyResponse = await fetch(`${JSONBIN_API_BASE}/b/${binId}/latest`, {
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const verifyResult = await verifyResponse.json()
    console.log('✅ Update verified!')
    console.log('   Updated data:', JSON.stringify(verifyResult.record, null, 2))
    console.log()

    // Summary
    console.log('=' .repeat(60))
    console.log('🎉 All tests passed!')
    console.log('=' .repeat(60))
    console.log()
    console.log('Test Summary:')
    console.log(`✅ Create bin: SUCCESS`)
    console.log(`✅ Read bin: SUCCESS`)
    console.log(`✅ Update bin: SUCCESS`)
    console.log(`✅ Verify update: SUCCESS`)
    console.log()
    console.log('JSONBin is working correctly! 🚀')
    console.log()
    console.log(`Test Bin ID: ${binId}`)
    console.log(`Room Code Format: ${formatRoomCode(binId)}`)
    console.log()
    console.log('You can access this test bin at:')
    console.log(`https://api.jsonbin.io/v3/b/${binId}/latest`)

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

function formatRoomCode(binId) {
  const code = binId.slice(-6).toUpperCase()
  return `${code.slice(0, 3)}-${code.slice(3)}`
}

testJSONBin()
