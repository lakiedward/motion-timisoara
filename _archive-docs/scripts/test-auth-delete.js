// Paste this in browser console (F12) to test DELETE request
// Make sure you're logged in first!

async function testDeleteCourse() {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        console.error('❌ No token found! Please login first.');
        return;
    }
    
    console.log('Token found:', token.substring(0, 20) + '...');
    
    // First, get list of courses to find a valid ID
    console.log('\n1️⃣ Getting list of courses...');
    
    const apiBase = document.querySelector('meta[name="api-base-url"]')?.content || '';
    const listUrl = `${apiBase}/api/admin/courses`;
    
    try {
        const listResponse = await fetch(listUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('GET response status:', listResponse.status);
        
        if (!listResponse.ok) {
            console.error('❌ Failed to get courses list');
            const errorText = await listResponse.text();
            console.error('Error:', errorText);
            return;
        }
        
        const courses = await listResponse.json();
        console.log('✅ Successfully got', courses.length, 'courses');
        
        if (courses.length === 0) {
            console.log('⚠️ No courses to delete. Create one first.');
            return;
        }
        
        // Try to find a course with 0 enrollments
        const courseToDelete = courses.find(c => c.enrolledCount === 0) || courses[0];
        console.log('\n2️⃣ Attempting to delete course:', courseToDelete.name, '(ID:', courseToDelete.id, ')');
        
        const confirmDelete = confirm(`Delete course "${courseToDelete.name}"?\n\nEnrolled: ${courseToDelete.enrolledCount}\nActive: ${courseToDelete.active}`);
        
        if (!confirmDelete) {
            console.log('❌ Delete cancelled by user');
            return;
        }
        
        // Now try DELETE
        const deleteUrl = `${apiBase}/api/admin/courses/${courseToDelete.id}`;
        console.log('DELETE URL:', deleteUrl);
        console.log('Headers:', {
            'Authorization': `Bearer ${token.substring(0, 20)}...`,
            'Content-Type': 'application/json'
        });
        
        const deleteResponse = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('DELETE response status:', deleteResponse.status);
        console.log('DELETE response headers:', [...deleteResponse.headers.entries()]);
        
        if (deleteResponse.status === 204) {
            console.log('✅ Course deleted successfully!');
        } else {
            console.error('❌ Delete failed with status:', deleteResponse.status);
            
            try {
                const errorData = await deleteResponse.json();
                console.error('Error response:', errorData);
                console.table(errorData);
            } catch (e) {
                const errorText = await deleteResponse.text();
                console.error('Error text:', errorText);
            }
        }
        
    } catch (error) {
        console.error('❌ Network error:', error);
        console.error('Stack:', error.stack);
    }
}

// Auto-run
console.log('🔍 Testing DELETE course with authentication...\n');
testDeleteCourse();



